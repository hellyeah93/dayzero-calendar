import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dayzero.calendar',
  appName: 'DayZero Calendar',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      iconColor: '#b8b8b8'
    }
  }
};

export default config;
