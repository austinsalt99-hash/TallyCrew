import Foundation
import Capacitor

// JS-facing bridge (window.Capacitor.Plugins.SiriToken via src/lib/siriPlugin.ts).
// Lets the Settings screen store/clear the Siri Shortcuts bearer token without
// ever putting it in localStorage or a cookie the WebView could leak.
@objc(SiriTokenPlugin)
public class SiriTokenPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SiriTokenPlugin"
    public let jsName = "SiriToken"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "save", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise)
    ]

    @objc func save(_ call: CAPPluginCall) {
        guard let token = call.getString("token"), !token.isEmpty else {
            call.reject("Missing token")
            return
        }
        SiriKeychain.save(token)
        call.resolve()
    }

    @objc func clear(_ call: CAPPluginCall) {
        SiriKeychain.clear()
        call.resolve()
    }
}
