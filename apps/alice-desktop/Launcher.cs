// Offline launcher: custom Robin scene, real preparation and first-frame handoff.
using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows.Forms;

internal sealed class Launcher : Form {
    private readonly string[] arguments;
    private readonly Bitmap background, robin;
    private readonly Timer animation = new Timer { Interval = 16 };
    private readonly Stopwatch clock = new Stopwatch();
    private readonly object statusLock = new object();
    private double progress, target = .02, previous;
    private string message = "正在打开冬日小室";
    private bool failed, cancelled, dragging;
    private Point dragStart;
    private const string VersionKey = "__PAYLOAD_KEY__";
    private const long ExpectedExeLength = __EXE_LENGTH__L;
#if PREVIEW
    private const string PreviewRoot = @"__PREVIEW_ROOT__";
#endif
    private Launcher(string[] args) {
        arguments = args; Text = "有珠 · 冬日小室";
        AccessibleName = "Robin 正在为你打开冬日小室";
        Icon = Icon.ExtractAssociatedIcon(Assembly.GetExecutingAssembly().Location);
        ClientSize = new Size(680, 400); AutoScaleMode = AutoScaleMode.Dpi;
        FormBorderStyle = FormBorderStyle.None; StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(23, 21, 31); DoubleBuffered = true;
        SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);
        background = ReadImage("Alice.SplashBackground"); robin = ReadImage("Alice.SplashRobin");
        if(args.Any(a => a.StartsWith("--verify-output="))) { Opacity = 0; ShowInTaskbar = false; }
        animation.Tick += delegate {
            double now = clock.Elapsed.TotalSeconds, dt = Math.Min(.1, now - previous); previous = now;
            lock(statusLock) progress += (target - progress) * (1 - Math.Exp(-dt * 7));
            Invalidate();
        };
        MouseDown += delegate(object sender, MouseEventArgs e) {
            if(e.Button != MouseButtons.Left) return;
            if(e.X*680f/ClientSize.Width > 600 && e.Y*400f/ClientSize.Height < 64) { cancelled = true; Close(); return; }
            dragging = true; dragStart = e.Location;
        };
        MouseMove += delegate(object sender, MouseEventArgs e) { if(dragging) Location = new Point(Location.X + e.X - dragStart.X, Location.Y + e.Y - dragStart.Y); };
        MouseUp += delegate { dragging = false; };
        Shown += async delegate { clock.Start(); animation.Start(); await Run(); };
        FormClosed += delegate { animation.Stop(); };
    }
    private static Bitmap ReadImage(string name) {
        using(Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(name)) {
            if(stream == null) throw new IOException("启动画面资源缺失。");
            using(Image source = Image.FromStream(stream)) return new Bitmap(source);
        }
    }
    private static GraphicsPath Rounded(RectangleF r, float radius) {
        var p = new GraphicsPath(); float d = radius * 2;
        p.AddArc(r.X,r.Y,d,d,180,90); p.AddArc(r.Right-d,r.Y,d,d,270,90);
        p.AddArc(r.Right-d,r.Bottom-d,d,d,0,90); p.AddArc(r.X,r.Bottom-d,d,d,90,90); p.CloseFigure(); return p;
    }
    protected override void OnSizeChanged(EventArgs e) {
        base.OnSizeChanged(e);
        using(var shape = Rounded(new RectangleF(0,0,ClientSize.Width,ClientSize.Height),15*ClientSize.Width/680f)) { Region old=Region; Region=new Region(shape); if(old!=null)old.Dispose(); }
    }
    private void Status(string text, double amount) { lock(statusLock) {message=text;target=Math.Max(target,Math.Min(1,amount));} }
    private static void Spaced(Graphics g, string text, Font font, Brush brush, float x, float y, float spacing) {
        foreach(char letter in text) {string c=letter.ToString();g.DrawString(c,font,brush,x,y);x+=g.MeasureString(c,font,100,StringFormat.GenericTypographic).Width+spacing;}
    }
    protected override void OnPaint(PaintEventArgs e) {base.OnPaint(e);PaintScene(e.Graphics,progress,clock.Elapsed.TotalSeconds);}
    private void PaintScene(Graphics g, double amount, double time) {
        g.SmoothingMode=SmoothingMode.AntiAlias;g.InterpolationMode=InterpolationMode.HighQualityBicubic;
        g.ScaleTransform(ClientSize.Width/680f,ClientSize.Height/400f);
        float cover=Math.Max(680f/background.Width,400f/background.Height);
        g.DrawImage(background,new RectangleF((680-background.Width*cover)/2,(400-background.Height*cover)/2,background.Width*cover,background.Height*cover));
        using(var veil=new LinearGradientBrush(new Rectangle(0,0,680,400),Color.FromArgb(236,18,17,27),Color.FromArgb(155,16,17,28),0f))g.FillRectangle(veil,0,0,680,400);
        using(var lower=new LinearGradientBrush(new Rectangle(0,0,680,400),Color.FromArgb(0,17,15,24),Color.FromArgb(225,17,15,24),90f))g.FillRectangle(lower,0,0,680,400);
        using(var edge=new Pen(Color.FromArgb(100,197,171,124),1))using(var border=Rounded(new RectangleF(.5f,.5f,679,399),15))g.DrawPath(edge,border);
        using(var gold=new SolidBrush(Color.FromArgb(235,215,178)))using(var muted=new SolidBrush(Color.FromArgb(179,163,146)))
        using(var small=new Font("Georgia",8.5f))using(var title=new Font("SimSun",30))using(var subtitle=new Font("Microsoft YaHei UI",9)) {
            Spaced(g,"THE WINTER ROOM",small,gold,41,33,2.2f);Spaced(g,"冬日小室",title,gold,39,87,5);
            g.DrawString("久远寺有珠  ·  Robin 的来访",subtitle,muted,43,148);
            g.DrawString("窗边的灯已经点亮，请稍候片刻。",subtitle,muted,43,363);
            using(var status=new SolidBrush(failed?Color.FromArgb(225,177,166):Color.FromArgb(224,207,180)))
            using(var font=new Font("Microsoft YaHei UI",10.5f))g.DrawString(message,font,status,new RectangleF(43,316,588,42));
        }
        using(var pen=new Pen(Color.FromArgb(105,205,179,129),.8f)){g.DrawLine(pen,613,38,626,51);g.DrawLine(pen,626,38,613,51);}
        float x=79+(float)amount*522,y=245-(float)Math.Sin(amount*Math.PI)*16+(float)Math.Sin(time*3.8)*2;
        using(var trail=new Pen(Color.FromArgb(42,214,185,128),.8f))g.DrawBezier(trail,79,245,220,224,452,224,601,245);
        for(int n=0;n<7;n++){double p=amount-n*.017;if(p<0)continue;float px=79+(float)p*522,py=245-(float)Math.Sin(p*Math.PI)*16,r=1.5f-n*.12f;using(var dot=new SolidBrush(Color.FromArgb((int)(65*(1-n/7.0)),227,196,131)))g.FillEllipse(dot,px-r,py-r,r*2,r*2);}
        int frame=failed?0:((int)(time*108)%24);
        g.DrawImage(robin,new RectangleF(x-56,y-58,112,112),new RectangleF(frame%8*128,frame/8*128,128,128),GraphicsUnit.Pixel);
    }
    private static string Quote(string value) {
        if(value.Length>0&&value.All(c=>!char.IsWhiteSpace(c)&&c!='"'))return value;
        var result=new System.Text.StringBuilder("\"");int slashes=0;
        foreach(char c in value){if(c=='\\'){slashes++;continue;}if(c=='"')result.Append('\\',slashes*2+1).Append('"');else result.Append('\\',slashes).Append(c);slashes=0;}
        return result.Append('\\',slashes*2).Append('"').ToString();
    }
    private async Task Run() {
        string marker=Path.Combine(Path.GetTempPath(),"AliceKuonji-Startup-"+Guid.NewGuid().ToString("N")+".ready");
        bool verify=arguments.Any(a=>a.StartsWith("--verify-output="));
        try {
            string executable,working,childArguments;
#if PREVIEW
            working=PreviewRoot;executable=Path.Combine(PreviewRoot,"node_modules","electron","dist","electron.exe");
            if(!File.Exists(executable))throw new IOException("请将此预览入口保留在现有 live2d 工作区中。");
            childArguments=Quote(Path.Combine(PreviewRoot,"apps","alice-desktop"))+" "+Quote("--preview-profile="+Path.Combine(PreviewRoot,"output","alice-wardrobe-sushi-v2","profile"))+" "+string.Join(" ",arguments.Select(Quote));
            Status("正在整理冬日小室",.15);
#else
            working=await Task.Run(()=>Prepare());executable=Path.Combine(working,"AliceKuonji.exe");childArguments=string.Join(" ",arguments.Select(Quote));
#endif
            if(cancelled||IsDisposed)return;Status("正在请有珠过来",.78);
            var info=new ProcessStartInfo(executable){WorkingDirectory=working,UseShellExecute=false,Arguments=childArguments};
            info.EnvironmentVariables["ALICE_LAUNCH_DIR"]=Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            info.EnvironmentVariables["ALICE_STARTUP_READY_FILE"]=marker;
            Process child=Process.Start(info);if(child==null)throw new IOException("无法启动冬日小室。");
            if(verify){
                Hide();await Task.Run(()=>child.WaitForExit());Environment.ExitCode=child.ExitCode;
                string output=arguments.First(a=>a.StartsWith("--verify-output=")).Substring("--verify-output=".Length);
                Directory.CreateDirectory(output);File.WriteAllText(Path.Combine(output,"launcher-verification.json"),"{\"readyAcknowledged\":"+(File.Exists(marker)&&File.ReadAllText(marker)=="ready"?"true":"false")+",\"childExitCode\":"+child.ExitCode+",\"nativeProgressControl\":false,\"borderless\":true}");
            }else{
                var wait=Stopwatch.StartNew();
                while(!File.Exists(marker)){
                    if(child.HasExited){if(child.ExitCode!=0)throw new IOException("冬日小室未能启动。");Close();return;}
                    if(cancelled||IsDisposed)return;if(wait.Elapsed.TotalSeconds>90)throw new IOException("准备时间较长，请关闭此提示后检查程序。");await Task.Delay(35);
                }
                if(File.ReadAllText(marker)=="ready"){Status("她已经在等你了",1);await Task.Delay((int)Math.Max(240,800-clock.ElapsedMilliseconds));for(int n=0;n<10&&!IsDisposed;n++){Opacity=1-(n+1)/10.0;await Task.Delay(20);}}
            }
            Close();
        }catch(Exception error){Environment.ExitCode=1;if(verify)Close();else if(!IsDisposed){failed=true;Status("小室暂时未能打开："+error.Message,progress);Invalidate();}}
        finally{try{if(File.Exists(marker))File.Delete(marker);}catch{}}
    }
    private string Prepare(){
        string root=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"AliceKuonjiWinter");Directory.CreateDirectory(root);
        string destination=Path.Combine(root,VersionKey),executable=Path.Combine(destination,"AliceKuonji.exe"),marker=Path.Combine(destination,".ready");
        if(File.Exists(marker)&&File.ReadAllText(marker)==VersionKey&&File.Exists(executable)&&new FileInfo(executable).Length==ExpectedExeLength&&File.Exists(Path.Combine(destination,"resources","app","web","model","AliceKuonjiWinter.moc3")))return destination;
        string staging=destination+"."+Guid.NewGuid().ToString("N").Substring(0,8);Directory.CreateDirectory(staging);
        using(Stream data=Assembly.GetExecutingAssembly().GetManifestResourceStream("Alice.Payload")){
            if(data==null)throw new IOException("程序内置资源缺失。");
            using(var zip=new ZipArchive(data,ZipArchiveMode.Read)){
                long total=zip.Entries.Sum(e=>e.Length),done=0;
                foreach(var entry in zip.Entries){
                    if(cancelled)throw new OperationCanceledException();string targetPath=Path.GetFullPath(Path.Combine(staging,entry.FullName.Replace('/',Path.DirectorySeparatorChar)));
                    if(!targetPath.StartsWith(staging+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))throw new IOException("无效的内置资源路径。");
                    if(entry.FullName.EndsWith("/"))Directory.CreateDirectory(targetPath);
                    else{Directory.CreateDirectory(Path.GetDirectoryName(targetPath));using(var input=entry.Open())using(var output=File.Create(targetPath))input.CopyTo(output);done+=entry.Length;Status("首次来访，正在整理小室",total==0?.02:done*.72/total);}
                }
            }
        }
        File.WriteAllText(Path.Combine(staging,".ready"),VersionKey);if(!Directory.Exists(destination)){Directory.Move(staging,destination);return destination;}return staging;
    }
    private void ExportFrames(string output){
        Directory.CreateDirectory(output);
        for(int n=0;n<120;n++){progress=n/119.0;message=n==119?"她已经在等你了":"正在请有珠过来";using(var image=new Bitmap(680,400))using(Graphics g=Graphics.FromImage(image)){PaintScene(g,progress,n/30.0);image.Save(Path.Combine(output,"native-"+n.ToString("000")+".png"),ImageFormat.Png);}}
        File.WriteAllText(Path.Combine(output,"native-splash.json"),"{\"ok\":true,\"frames\":120,\"fps\":30,\"width\":680,\"height\":400,\"nativeProgressControl\":false,\"borderless\":true}");
    }
    protected override void Dispose(bool disposing){if(disposing){animation.Dispose();background.Dispose();robin.Dispose();}base.Dispose(disposing);}
    [STAThread]private static void Main(string[] args){
        Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);string export=args.FirstOrDefault(a=>a.StartsWith("--splash-selftest-output="));
        using(var window=new Launcher(args)){if(export!=null)window.ExportFrames(export.Substring("--splash-selftest-output=".Length));else Application.Run(window);}
    }
}
