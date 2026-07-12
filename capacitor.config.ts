import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ca.tallycrew.app",
  appName: "TallyCrew",
  webDir: "out",
  server: {
    url: "https://www.tallycrew.ca",
    cleartext: false,
  },
  plugins: {
    StatusBar: {
      style: "Dark",
      backgroundColor: "#ffffff",
    },
    Keyboard: {
      resizeOnFullScreen: true,
    },
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#ffffff",
      iosSpinnerStyle: "small",
      showSpinner: false,
    },
  },
};

export default config;
