"""Private JSON-lines speech worker owned by the Electron application."""
import argparse
import contextlib
import json
import os
from pathlib import Path
import re
import sys
import uuid


class VoiceEngine:
    def __init__(self, workspace):
        import numpy as np
        import librosa
        import soundfile as sf
        import torch
        self.np=np;self.sf=sf;self.torch=torch
        repo=workspace/'.cache/GPT-SoVITS'
        output=workspace/'training/alice-ja/outputs/voice-pilot-v1'
        sys.path[:0]=[str(repo/'GPT_SoVITS'),str(repo)]
        os.environ['version']='v2'
        from AR.models.t2s_lightning_module import Text2SemanticLightningModule
        from feature_extractor.cnhubert import CNHubert
        from module.models import SynthesizerTrn
        from module.mel_processing import spectrogram_torch
        from process_ckpt import load_sovits_new
        from text.cleaner import clean_text
        from text import cleaned_text_to_sequence
        from utils import HParams
        torch.set_num_threads(4)
        self.device='cuda' if torch.cuda.is_available() else 'cpu'
        self.dtype=torch.float16 if self.device=='cuda' else torch.float32
        checkpoint=load_sovits_new(str(output/'weights/SoVITS/alice_ja_pilot_v1_e8_s304.pth'))
        hps=checkpoint['config'];hps=HParams(**hps) if isinstance(hps,dict) else hps
        self.decoder=SynthesizerTrn(hps.data.filter_length//2+1,hps.train.segment_size//hps.data.hop_length,n_speakers=hps.data.n_speakers,**hps.model)
        self.decoder.load_state_dict(checkpoint['weight'],strict=False)
        self.decoder=self.decoder.eval().to(device=self.device,dtype=self.dtype)
        weights=torch.load(output/'weights/GPT/alice_ja_pilot_v1-e10.ckpt',map_location='cpu',weights_only=False)
        self.semantic=Text2SemanticLightningModule(weights['config'],output,is_train=False)
        self.semantic.load_state_dict(weights['weight']);self.semantic=self.semantic.eval().to(device=self.device,dtype=self.dtype)
        hubert=CNHubert(str(repo/'GPT_SoVITS/pretrained_models/chinese-hubert-base')).eval().to(device=self.device,dtype=self.dtype)
        selected=json.loads((workspace/'training/alice-ja/audio/selected-v1/selection.json').read_text(encoding='utf-8'))
        reference=next(r for r in selected if r['id']=='alice_01626')
        audio,self.sr=sf.read(str(workspace/'training/alice-ja/audio/selected-v1'/reference['audio_path']),dtype='float32')
        assert self.sr==32000
        waveform=np.concatenate([librosa.resample(audio,orig_sr=self.sr,target_sr=16000),np.zeros(4800,dtype=np.float32)])
        with torch.inference_mode():
            ssl=hubert.model(torch.from_numpy(waveform).to(device=self.device,dtype=self.dtype).unsqueeze(0))['last_hidden_state'].transpose(1,2)
            self.prompt=self.decoder.extract_latent(ssl)[0,0].unsqueeze(0)
            self.spectrum=spectrogram_torch(torch.from_numpy(audio).unsqueeze(0).to(self.device),hps.data.filter_length,hps.data.sampling_rate,hps.data.hop_length,hps.data.win_length,center=False).to(self.dtype)
        del hubert
        self.clean_text=clean_text;self.to_sequence=cleaned_text_to_sequence
        self.ref_phones=self.phones(reference['text'])

    def phones(self,text):
        # The Japanese proper name Aoko is ambiguous to generic G2P dictionaries.
        text=text.replace('青子','あおこ')
        cleaned,_,_=self.clean_text(text,'ja','v2')
        return self.to_sequence(cleaned,'v2')

    def synthesize(self,text,destination):
        if not isinstance(text,str) or not 1<=len(text.strip())<=120:
            raise ValueError('请输入 1–120 字的日语台词。')
        chunks=[s.strip() for s in re.split(r'(?<=[。！？!?])|[\r\n]+',text.strip()) if s.strip()]
        if any(len(s)>60 for s in chunks):raise ValueError('每句请控制在 60 字以内，用句号分隔。')
        torch=self.torch;np=self.np;parts=[];cues=[];cursor=0
        torch.manual_seed(42)
        for chunk in chunks:
            target=self.phones(chunk)
            joined=torch.tensor([self.ref_phones+target],dtype=torch.long,device=self.device)
            bert=torch.zeros((1,1024,joined.shape[-1]),dtype=self.dtype,device=self.device)
            with torch.inference_mode():
                codes,count=self.semantic.model.infer_panel(joined,torch.tensor([joined.shape[-1]],device=self.device),self.prompt,bert,top_k=15,top_p=1.,temperature=.9,early_stop_num=25*18,repetition_penalty=1.35)
                if count<=0:raise ValueError('未生成有效语音，请缩短句子后重试。')
                audio=self.decoder.decode(codes[:,-count:].unsqueeze(0),torch.tensor([target],device=self.device),[self.spectrum],speed=1.)[0,0].float().cpu().numpy()
            if not np.isfinite(audio).all() or not .2<len(audio)/self.sr<18 or np.abs(audio).max()<1e-5:
                raise ValueError('语音生成不完整，请缩短句子后重试。')
            peak=float(np.abs(audio).max())
            if peak>1:audio=audio/peak
            if parts:parts.append(np.zeros(7040,dtype=np.float32));cursor+=7040
            start=cursor/self.sr;parts.append(audio);cursor+=len(audio)
            cues.append({'start':start,'end':cursor/self.sr,'ja':chunk})
        self.sf.write(str(destination),np.concatenate(parts),self.sr,subtype='PCM_16')
        return {'duration':cursor/self.sr,'cues':cues}


def send(data):
    print('ALICE_VOICE:'+json.dumps(data,ensure_ascii=False),flush=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workspace',type=Path,required=True)
    parser.add_argument('--output-dir',type=Path,required=True)
    args=parser.parse_args()
    args.output_dir.mkdir(parents=True,exist_ok=True)
    os.environ.update({'HF_HUB_OFFLINE':'1','TRANSFORMERS_OFFLINE':'1','version':'v2'})
    with contextlib.redirect_stdout(sys.stderr):engine=VoiceEngine(args.workspace.resolve())
    send({'type':'ready','device':engine.device})
    for line in sys.stdin:
        request={}
        try:
            request=json.loads(line)
            destination=args.output_dir/(uuid.uuid4().hex+'.wav')
            with contextlib.redirect_stdout(sys.stderr):result=engine.synthesize(request.get('text'),destination)
            send({'type':'result','id':request['id'],'path':str(destination),**result})
        except Exception as error:
            send({'type':'error','id':request.get('id'),'message':str(error)})


if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8',errors='replace');sys.stderr.reconfigure(encoding='utf-8',errors='replace')
    main()
