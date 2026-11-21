using System;
using System.IO;
using System.Linq;
using System.Speech.Synthesis;
using System.Speech.AudioFormat;
using System.Web.Script.Serialization;
using System.Collections.Generic;

// Local Windows speech only. Text arrives through stdin, never a shell command.
internal static class SystemVoice {
    static int Main(string[] args) {
        Console.InputEncoding=new System.Text.UTF8Encoding(false);Console.OutputEncoding=new System.Text.UTF8Encoding(false);
        var json=new JavaScriptSerializer();
        try {
            using(var voice=new SpeechSynthesizer()) {
                var installed=voice.GetInstalledVoices().Where(v=>v.Enabled).Select(v=>v.VoiceInfo).ToArray();
                if(args.Length==1&&args[0]=="--voices") {
                    Console.Out.Write(json.Serialize(installed.Select(v=>new {name=v.Name,language=v.Culture.Name}).ToArray()));return 0;
                }
                if(args.Length!=2||args[0]!="--output")throw new Exception("Invalid speech request");
                var request=json.Deserialize<Dictionary<string,string>>(Console.In.ReadToEnd());
                var text=request["text"];var language=request["language"];
                if(String.IsNullOrWhiteSpace(text)||text.Length>2000)throw new Exception("Invalid speech text");
                var selected=installed.FirstOrDefault(v=>v.Name==request["voice"]&&v.Culture.Name==language);
                if(selected==null)throw new Exception("Requested Windows voice is unavailable");
                voice.SelectVoice(selected.Name);voice.Rate=-1;voice.Volume=100;
                voice.SetOutputToWaveFile(Path.GetFullPath(args[1]),new SpeechAudioFormatInfo(24000,AudioBitsPerSample.Sixteen,AudioChannel.Mono));
                voice.Speak(text);voice.SetOutputToNull();
                Console.Out.Write(json.Serialize(new {ok=true,language=selected.Culture.Name}));return 0;
            }
        } catch(Exception error) { Console.Error.Write("Windows local speech failed: "+error.GetType().Name+" / "+error.HResult);return 1; }
    }
}
