using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

// Only activity pulses and whitelisted command names leave this process. No character conversion,
// key logging, input injection, network access or global hotkey registration.
internal sealed class PulseWindow : NativeWindow {
    const int WM_INPUT = 0x00FF;
    readonly ShortcutClassifier shortcuts = new ShortcutClassifier();
    readonly Stopwatch clock = Stopwatch.StartNew();
    long last = -100;
    readonly bool mouse;
    [StructLayout(LayoutKind.Sequential)] struct Device { public ushort page, usage; public uint flags; public IntPtr target; }
    [StructLayout(LayoutKind.Sequential)] struct Header { public uint type, size; public IntPtr device, param; }
    [DllImport("user32.dll", SetLastError=true)] static extern bool RegisterRawInputDevices(Device[] devices, uint count, uint size);
    [DllImport("user32.dll", SetLastError=true)] static extern uint GetRawInputData(IntPtr handle, uint command, IntPtr data, ref uint size, uint headerSize);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
    static bool Down(int key) { return (GetAsyncKeyState(key)&0x8000)!=0; }
    public PulseWindow(bool includeMouse) {
        mouse=includeMouse; CreateHandle(new CreateParams { Caption="Alice keyboard activity", Parent=new IntPtr(-3) });
        Device[] devices = mouse ? new Device[2] : new Device[1];
        devices[0]=new Device {page=1,usage=6,flags=0x100,target=Handle};
        if(mouse)devices[1]=new Device {page=1,usage=2,flags=0x100,target=Handle};
        if(!RegisterRawInputDevices(devices,(uint)devices.Length,(uint)Marshal.SizeOf(typeof(Device))))throw new InvalidOperationException("Input registration failed");
    }
    void Pulse(string kind) { if(kind==null)return;long now=clock.ElapsedMilliseconds; if(kind=="T"||kind=="M"){if(now-last<22)return;last=now;}Console.WriteLine(kind);Console.Out.Flush(); }
    protected override void WndProc(ref Message msg) {
        if(msg.Msg==WM_INPUT) {
            uint size=0, hs=(uint)Marshal.SizeOf(typeof(Header));
            if(GetRawInputData(msg.LParam,0x10000003,IntPtr.Zero,ref size,hs)==0&&size>=hs&&size<4096) {
                IntPtr data=Marshal.AllocHGlobal((int)size);
                try {
                    if(GetRawInputData(msg.LParam,0x10000003,data,ref size,hs)==size) {
                        Header h=(Header)Marshal.PtrToStructure(data,typeof(Header));IntPtr body=IntPtr.Add(data,(int)hs);
                        if(h.type==1&&size>=hs+16) {
                            ushort flags=(ushort)Marshal.ReadInt16(body,2), key=(ushort)Marshal.ReadInt16(body,6);
                            // Snapshot only modifier state; this also handles enabling mode mid-chord.
                            Pulse(shortcuts.Key(key,(flags&1)!=0,Down(17),Down(16),Down(18),Down(91)||Down(92)));
                        } else if(mouse&&h.type==0&&size>=hs+24&&(((ushort)Marshal.ReadInt16(body,4)&0x15)!=0))Pulse("M");
                    }
                } finally { Marshal.FreeHGlobal(data); }
            }
        }
        base.WndProc(ref msg);
    }
    [STAThread] static int Main(string[] args) {
        try {
            if(Array.IndexOf(args,"--self-test")>=0){ShortcutClassifier.Verify();Console.WriteLine("SELFTEST OK");return 0;}
            using(var lifetime=new Lifetime()) {
                var window=new PulseWindow(Array.IndexOf(args,"--mouse")>=0);
                // Closing the parent's pipe also closes this helper after a crash.
                var input=new Thread(()=>{try{while(Console.ReadLine()!=null){} }catch{} Environment.Exit(0);});input.IsBackground=true;input.Start();
                Console.WriteLine("READY");Console.Out.Flush();Application.Run();window.DestroyHandle();
            }
            return 0;
        } catch { Console.WriteLine("ERROR");Console.Out.Flush();return 1; }
    }
    sealed class Lifetime:IDisposable { public void Dispose(){} }
}

internal sealed class ShortcutClassifier {
    readonly HashSet<ushort> held = new HashSet<ushort>();
    public string Key(ushort key,bool up,bool ctrl,bool shift,bool alt,bool meta) {
        if(up){held.Remove(key);return null;}
        if(key==16||key==17||key==18||key==91||key==92||(key>=160&&key<=165)||key==255)return null;
        if(!held.Add(key))return null;
        if(!alt&&!meta){
            if(ctrl){
                if(key==90)return shift?"S:redo":"S:undo";
                if(!shift)switch(key){
                    case 67:return "S:copy";case 88:return "S:cut";case 86:return "S:paste";
                    case 83:return "S:save";case 89:return "S:redo";case 70:return "S:find";case 65:return "S:select";
                }
            }else if(!shift){if(key==13)return "S:confirm";if(key==27)return "S:dismiss";}
        }
        return "T";
    }
    public static void Verify(){
        ushort[] keys={67,88,86,83,90,89,70,65};string[] names={"copy","cut","paste","save","undo","redo","find","select"};
        for(int i=0;i<keys.Length;i++){
            var c=new ShortcutClassifier();Check(c.Key(17,false,true,false,false,false),null);
            Check(c.Key(keys[i],false,true,false,false,false),"S:"+names[i]);
            Check(c.Key(keys[i],false,true,false,false,false),null);
            Check(c.Key(keys[i],true,true,false,false,false),null);
            Check(c.Key(keys[i],false,false,false,false,false),"T");
            c=new ShortcutClassifier();Check(c.Key(keys[i],false,true,false,true,false),"T");
            c=new ShortcutClassifier();Check(c.Key(keys[i],false,true,false,false,true),"T");
        }
        var s=new ShortcutClassifier();Check(s.Key(90,false,true,true,false,false),"S:redo");
        s=new ShortcutClassifier();Check(s.Key(83,false,true,true,false,false),"T");
        s=new ShortcutClassifier();Check(s.Key(13,false,false,false,false,false),"S:confirm");
        s=new ShortcutClassifier();Check(s.Key(27,false,false,false,false,false),"S:dismiss");
        s=new ShortcutClassifier();Check(s.Key(13,false,false,true,false,false),"T");
    }
    static void Check(string actual,string expected){if(actual!=expected)throw new InvalidOperationException("Classifier self-test failed");}
}
