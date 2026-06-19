// Feature Flags
// Use this file to toggle features across the application without deploying new code.
// In a production app, these might be loaded from a database or a service like LaunchDarkly.

export const featureFlags = {
  enableAI: true,
  enableWhatsApp: false,
  enablePayroll: false,
  enablePushNotifications: false,
};

export type FeatureFlags = typeof featureFlags;
