using System;
using System.IO;
using System.Text;
using System.Diagnostics;
using System.Threading;
using System.Collections.Generic;
using System.Web.Script.Serialization;

// Chrome launches this short-lived helper; no server, login startup or shell is installed.
class Host {
    const string Origin = "chrome-extension://dknocgpgibkieijeipgfkaboiogddnbo/";
    static JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 1024 * 1024 };
    static byte[] Read(Stream stream, int count) {
        var buffer = new byte[count]; int offset = 0;
        while (offset < count) { int n = stream.Read(buffer, offset, count - offset); if (n == 0) throw new IOException("Eksik ileti."); offset += n; }
        return buffer;
    }
    static void Reply(object value) {
        var bytes = Encoding.UTF8.GetBytes(Json.Serialize(value));
        using (var output = Console.OpenStandardOutput()) {
            var prefix = BitConverter.GetBytes(bytes.Length); output.Write(prefix, 0, 4); output.Write(bytes, 0, bytes.Length); output.Flush();
        }
    }
    static int Main(string[] args) {
        // Check before reading state or starting any executable. Only the installed extension is allowed.
        if (args.Length == 0 || args[0] != Origin) return 2;
        try {
            using (var input = Console.OpenStandardInput()) {
                int size = BitConverter.ToInt32(Read(input, 4), 0);
                if (size < 2 || size > 4096) throw new IOException("Geçersiz ileti boyutu.");
                var message = Json.Deserialize<Dictionary<string, object>>(Encoding.UTF8.GetString(Read(input, size)));
                if (message == null || message.Count != 1 || !message.ContainsKey("action") || !Object.Equals(message["action"], "start")) throw new IOException("İşlem desteklenmiyor.");
            }
            string executable = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "hea-indir.exe"));
            if (!File.Exists(executable)) throw new IOException("Windows paketini tamamen çıkarıp bağlantıyı yeniden kur.");
            var start = new ProcessStartInfo(executable, "--background") { UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden, WorkingDirectory = Path.GetDirectoryName(executable) };
            // Electron's development/runtime flags must not leak into the packaged application.
            start.EnvironmentVariables.Remove("ELECTRON_RUN_AS_NODE");
            start.EnvironmentVariables.Remove("NODE_OPTIONS");
            start.EnvironmentVariables.Remove("HEA_TEST_PROFILE");
            using (var process = Process.Start(start)) { }
            string statePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "hea-indir", "state.json");
            for (int attempt = 0; attempt < 60; attempt++) {
                try {
                    var state = Json.Deserialize<Dictionary<string, object>>(File.ReadAllText(statePath));
                    var browser = state["browser"] as Dictionary<string, object>;
                    var token = browser["token"] as string;
                    if (token != null && System.Text.RegularExpressions.Regex.IsMatch(token, "\\A[a-f0-9]{64}\\z")) { Reply(new { ok = true, token = token }); return 0; }
                } catch (IOException) { } catch (KeyNotFoundException) { } catch (ArgumentException) { }
                Thread.Sleep(200);
            }
            throw new IOException("hea-indir başlayamadı. Eski sürüm açıksa sağ alttan çıkıp yeniden dene.");
        } catch (Exception e) { Reply(new { ok = false, error = e.Message }); return 1; }
    }
}
