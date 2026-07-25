import { registerPlugin } from "@capacitor/core";

export interface SiriTokenPlugin {
  save(options: { token: string }): Promise<void>;
  clear(): Promise<void>;
}

// Bridges to ios/App/App/SiriTokenPlugin.swift, which stores the token in the
// Keychain where the AddJobIntent App Intent can read it in the background.
const SiriToken = registerPlugin<SiriTokenPlugin>("SiriToken");

export default SiriToken;
