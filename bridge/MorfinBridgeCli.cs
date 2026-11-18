using System;
using System.Collections.Generic;
using MorFin_Auth;

namespace FingerprintAttendance.MorfinBridge
{
    internal static class Program
    {
        private const int DefaultTimeout = 30000;
        private const int DefaultQuality = 75;
        private const int CompressionRatio = 5;
        private const TEMPLATE_FORMAT TemplateFormat = TEMPLATE_FORMAT.FMR_V2005;

        private static int Main(string[] args)
        {
            if (args.Length == 0)
            {
                WriteJson(false, "Command is required. Use info, capture, or match.");
                return 1;
            }

            try
            {
                switch (args[0].ToLowerInvariant())
                {
                    case "info":
                        return Info();
                    case "capture":
                        return Capture(args);
                    case "capture-stream":
                        int captureStreamCode = CaptureStream(args);
                        Environment.Exit(captureStreamCode);
                        return captureStreamCode;
                    case "match":
                        return Match(args);
                    default:
                        WriteJson(false, "Unknown command: " + args[0]);
                        return 1;
                }
            }
            catch (Exception ex)
            {
                WriteJson(false, ex.Message);
                return 1;
            }
        }

        private static int Info()
        {
            using (var sdk = new MorfinSession())
            {
                string version;
                int ret = sdk.Auth.GetSDKVersion(out version);
                if (ret != 0)
                {
                    WriteJson(false, sdk.Error(ret));
                    return 1;
                }

                var devices = new List<string>();
                ret = sdk.Auth.GetConnectedDevices(devices);
                if (ret != 0)
                {
                    WriteJson(false, sdk.Error(ret), "\"version\":\"" + Escape(version) + "\"");
                    return 1;
                }

                version = version == null ? "" : version.TrimEnd('\0');

                WriteJson(
                    true,
                    null,
                    "\"version\":\"" + Escape(version) + "\"," +
                    "\"connected\":" + (devices.Count > 0 ? "true" : "false") + "," +
                    "\"devices\":[" + JoinDevices(devices) + "]"
                );
                return 0;
            }
        }

        private static int Capture(string[] args)
        {
            using (var sdk = new MorfinSession())
            {
                string deviceName;
                var deviceInfo = new FINGER_DEVICE_INFO();
                if (!sdk.InitFirstConnectedDevice(out deviceName, ref deviceInfo))
                {
                    return 1;
                }

                int timeout = DefaultTimeout;
                int requestedQuality = DefaultQuality;
                if (args.Length > 2)
                {
                    int.TryParse(args[2], out timeout);
                    if (timeout <= 0)
                    {
                        timeout = DefaultTimeout;
                    }
                }
                if (args.Length > 3)
                {
                    int.TryParse(args[3], out requestedQuality);
                    if (requestedQuality <= 0 || requestedQuality > 100)
                    {
                        requestedQuality = DefaultQuality;
                    }
                }

                int quality;
                int nfiq;
                int ret = sdk.Auth.AutoCapture(out quality, out nfiq, timeout, requestedQuality);
                if (ret != 0)
                {
                    WriteJson(false, sdk.Error(ret));
                    return 1;
                }

                byte[] template;
                ret = sdk.Auth.GetTemplate(out template, TemplateFormat, CompressionRatio);
                if (ret != 0)
                {
                    WriteJson(false, sdk.Error(ret));
                    return 1;
                }

                byte[] image;
                string imageJson = "";
                ret = sdk.Auth.GetImage(out image, IMAGE_FORMAT.BMP, CompressionRatio);
                if (ret == 0 && image != null && image.Length > 0)
                {
                    imageJson =
                        ",\"imageData\":\"" + Convert.ToBase64String(image) + "\"," +
                        "\"imageMimeType\":\"image/bmp\"";
                }
                else if (ret != 0)
                {
                    imageJson = ",\"imageError\":\"" + Escape(sdk.Error(ret)) + "\"";
                }

                WriteJson(
                    true,
                    null,
                    "\"templateData\":\"" + Convert.ToBase64String(template) + "\"," +
                    "\"quality\":" + quality + "," +
                    "\"nfiq\":" + nfiq + "," +
                    "\"device\":\"" + Escape(deviceName) + "\"" +
                    imageJson
                );
                return 0;
            }
        }

        private static int CaptureStream(string[] args)
        {
            using (var sdk = new MorfinSession())
            {
                string deviceName;
                var deviceInfo = new FINGER_DEVICE_INFO();
                if (!sdk.InitFirstConnectedDevice(out deviceName, ref deviceInfo))
                {
                    return 1;
                }

                int timeout = DefaultTimeout;
                int requestedQuality = DefaultQuality;
                if (args.Length > 2)
                {
                    int.TryParse(args[2], out timeout);
                    if (timeout <= 0)
                    {
                        timeout = DefaultTimeout;
                    }
                }
                if (args.Length > 3)
                {
                    int.TryParse(args[3], out requestedQuality);
                    if (requestedQuality <= 0 || requestedQuality > 100)
                    {
                        requestedQuality = DefaultQuality;
                    }
                }

                var completed = new System.Threading.ManualResetEvent(false);
                CaptureData finalCapture = null;
                object sync = new object();

                sdk.Auth.OnPreview += delegate(CaptureData data)
                {
                    lock (sync)
                    {
                        WriteStreamEvent(
                            "preview",
                            "\"quality\":" + data.Quality + "," +
                            "\"nfiq\":" + data.Nfiq + "," +
                            "\"fingerPosition\":\"" + Escape(data.FingerPosition.ToString()) + "\"," +
                            "\"message\":\"" + Escape(GetPlacementMessage(data.FingerPosition, data.Quality, requestedQuality)) + "\""
                        );
                    }
                };

                sdk.Auth.OnFingerPosition += delegate(CaptureData data)
                {
                    lock (sync)
                    {
                        WriteStreamEvent(
                            "position",
                            "\"quality\":" + data.Quality + "," +
                            "\"fingerPosition\":\"" + Escape(data.FingerPosition.ToString()) + "\"," +
                            "\"message\":\"" + Escape(GetPlacementMessage(data.FingerPosition, data.Quality, requestedQuality)) + "\""
                        );
                    }
                };

                sdk.Auth.OnCaptureCompleted += delegate(CaptureData data)
                {
                    finalCapture = data;
                    completed.Set();
                };

                WriteStreamEvent(
                    "started",
                    "\"device\":\"" + Escape(deviceName) + "\"," +
                    "\"requiredQuality\":" + requestedQuality + "," +
                    "\"timeoutMs\":" + timeout + "," +
                    "\"message\":\"Place your finger flat in the center of the scanner.\""
                );

                int ret = sdk.Auth.StartCapture(timeout, requestedQuality);
                if (ret != 0)
                {
                    WriteStreamEvent("done", "\"success\":false,\"error\":\"" + Escape(sdk.Error(ret)) + "\"");
                    return 1;
                }

                if (!completed.WaitOne(timeout + 5000))
                {
                    try
                    {
                        sdk.Auth.StopCapture();
                    }
                    catch
                    {
                    }
                    WriteStreamEvent("done", "\"success\":false,\"error\":\"Fingerprint capture timed out before a valid finger was captured.\"");
                    return 1;
                }

                try
                {
                    sdk.Auth.StopCapture();
                }
                catch
                {
                }

                if (finalCapture == null)
                {
                    WriteStreamEvent("done", "\"success\":false,\"error\":\"Fingerprint capture ended without capture data.\"");
                    return 1;
                }

                if (finalCapture.ErrorCode != 0)
                {
                    WriteStreamEvent("done", "\"success\":false,\"error\":\"" + Escape(sdk.Error(finalCapture.ErrorCode)) + "\"");
                    return 1;
                }

                byte[] template;
                ret = sdk.Auth.GetTemplate(out template, TemplateFormat, CompressionRatio);
                if (ret != 0)
                {
                    WriteStreamEvent("done", "\"success\":false,\"error\":\"" + Escape(sdk.Error(ret)) + "\"");
                    return 1;
                }

                byte[] image;
                string imageJson = "";
                ret = sdk.Auth.GetImage(out image, IMAGE_FORMAT.BMP, CompressionRatio);
                if (ret == 0 && image != null && image.Length > 0)
                {
                    imageJson =
                        ",\"imageData\":\"" + Convert.ToBase64String(image) + "\"," +
                        "\"imageMimeType\":\"image/bmp\"";
                }
                else if (ret != 0)
                {
                    imageJson = ",\"imageError\":\"" + Escape(sdk.Error(ret)) + "\"";
                }

                WriteStreamEvent(
                    "done",
                    "\"success\":true," +
                    "\"templateData\":\"" + Convert.ToBase64String(template) + "\"," +
                    "\"quality\":" + finalCapture.Quality + "," +
                    "\"nfiq\":" + finalCapture.Nfiq + "," +
                    "\"fingerPosition\":\"" + Escape(finalCapture.FingerPosition.ToString()) + "\"," +
                    "\"device\":\"" + Escape(deviceName) + "\"," +
                    "\"message\":\"Fingerprint captured clearly.\"" +
                    imageJson
                );
                return 0;
            }
        }

        private static int Match(string[] args)
        {
            if (args.Length < 3)
            {
                WriteJson(false, "match requires probeTemplate and galleryTemplate arguments.");
                return 1;
            }

            byte[] probe;
            byte[] gallery;
            try
            {
                probe = Convert.FromBase64String(args[1]);
                gallery = Convert.FromBase64String(args[2]);
            }
            catch
            {
                WriteJson(false, "Templates must be base64 encoded Morfin templates.");
                return 1;
            }

            using (var sdk = new MorfinSession())
            {
                string deviceName;
                var deviceInfo = new FINGER_DEVICE_INFO();
                if (!sdk.InitFirstConnectedDevice(out deviceName, ref deviceInfo))
                {
                    return 1;
                }

                int score;
                int ret = sdk.Auth.MatchTemplate(
                    probe,
                    probe.Length,
                    gallery,
                    gallery.Length,
                    out score,
                    TemplateFormat
                );

                if (ret != 0)
                {
                    WriteJson(false, sdk.Error(ret));
                    return 1;
                }

                WriteJson(true, null, "\"score\":" + score);
                return 0;
            }
        }

        private static string JoinDevices(List<string> devices)
        {
            var escaped = new List<string>();
            foreach (var device in devices)
            {
                escaped.Add("\"" + Escape(device) + "\"");
            }
            return string.Join(",", escaped.ToArray());
        }

        private static void WriteJson(bool success, string error, string extraFields = null)
        {
            var json = "{\"success\":" + (success ? "true" : "false");
            if (!string.IsNullOrEmpty(error))
            {
                json += ",\"error\":\"" + Escape(error) + "\"";
            }
            if (!string.IsNullOrEmpty(extraFields))
            {
                json += "," + extraFields;
            }
            json += "}";
            Console.WriteLine(json);
        }

        private static void WriteStreamEvent(string eventName, string fields)
        {
            Console.WriteLine("{\"event\":\"" + Escape(eventName) + "\"," + fields + "}");
            Console.Out.Flush();
        }

        private static string GetPlacementMessage(FINGER_POSITION position, int quality, int requestedQuality)
        {
            if (position == FINGER_POSITION.POSITION_LEFT)
            {
                return "Move your finger slightly to the right.";
            }
            if (position == FINGER_POSITION.POSITION_RIGHT)
            {
                return "Move your finger slightly to the left.";
            }
            if (position == FINGER_POSITION.POSITION_TOP)
            {
                return "Move your finger slightly down.";
            }
            if (position == FINGER_POSITION.POSITION_NOT_IN_BOTTOM)
            {
                return "Place more of the lower finger pad on the scanner.";
            }
            if (position == FINGER_POSITION.POSITION_NOT_OK)
            {
                return "Place your finger flat in the center of the scanner.";
            }
            if (quality <= 0)
            {
                return "Place your finger on the scanner.";
            }
            if (quality < 55)
            {
                return "Press a little more and keep your finger flat.";
            }
            if (quality < requestedQuality)
            {
                return "Almost there. Hold still until the quality improves.";
            }
            return "Good placement. Keep still.";
        }

        private static string Escape(string value)
        {
            if (value == null)
            {
                return "";
            }

            var output = new System.Text.StringBuilder();
            foreach (char c in value)
            {
                switch (c)
                {
                    case '\\':
                        output.Append("\\\\");
                        break;
                    case '"':
                        output.Append("\\\"");
                        break;
                    case '\r':
                        output.Append("\\r");
                        break;
                    case '\n':
                        output.Append("\\n");
                        break;
                    case '\t':
                        output.Append("\\t");
                        break;
                    default:
                        if (char.IsControl(c))
                        {
                            output.Append("\\u");
                            output.Append(((int)c).ToString("x4"));
                        }
                        else
                        {
                            output.Append(c);
                        }
                        break;
                }
            }
            return output.ToString();
        }
    }

    internal sealed class MorfinSession : IDisposable
    {
        public MorFinAuth Auth { get; private set; }
        private bool initialized;

        public MorfinSession()
        {
            Auth = new MorFinAuth();
            Auth.EnableLogs(MorFin_Auth_LOG_LEVEL.MorFin_Auth_LOG_LEVEL_OFF, null);
        }

        public bool InitFirstConnectedDevice(out string deviceName, ref FINGER_DEVICE_INFO deviceInfo)
        {
            deviceName = null;

            var devices = new List<string>();
            int ret = Auth.GetConnectedDevices(devices);
            if (ret != 0)
            {
                ProgramWrite(false, Error(ret));
                return false;
            }

            if (devices.Count == 0)
            {
                ProgramWrite(false, "No Morfin/Mantra fingerprint device is connected.");
                return false;
            }

            deviceName = devices[0];
            string clientKey = Environment.GetEnvironmentVariable("MORFIN_CLIENT_KEY") ?? "";
            ret = Auth.Init(deviceName, ref deviceInfo, clientKey);
            if (ret != 0)
            {
                ProgramWrite(false, Error(ret));
                return false;
            }

            initialized = true;
            return true;
        }

        public string Error(int code)
        {
            try
            {
                return Auth.GetErrDescription(code);
            }
            catch
            {
                return "Morfin SDK error code " + code;
            }
        }

        public void Dispose()
        {
            if (initialized)
            {
                try
                {
                    Auth.Uninit();
                }
                catch
                {
                }
            }
        }

        private static void ProgramWrite(bool success, string error)
        {
            var json = "{\"success\":" + (success ? "true" : "false") + ",\"error\":\"" +
                EscapeLocal(error) + "\"}";
            Console.WriteLine(json);
        }

        private static string EscapeLocal(string value)
        {
            if (value == null)
            {
                return "";
            }

            var output = new System.Text.StringBuilder();
            foreach (char c in value)
            {
                if (c == '\\')
                {
                    output.Append("\\\\");
                }
                else if (c == '"')
                {
                    output.Append("\\\"");
                }
                else if (char.IsControl(c))
                {
                    output.Append("\\u");
                    output.Append(((int)c).ToString("x4"));
                }
                else
                {
                    output.Append(c);
                }
            }
            return output.ToString();
        }
    }
}
