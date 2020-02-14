import Rollbar from 'rollbar';

export const RollbarInstance = new Rollbar({
  accessToken: '8de8a17f9f6d45f0a0d5c5b473c78f2d',
  captureUncaught: true,
  captureUnhandledRejections: true,
  payload: {
    environment: process.env.NODE_ENV,
  },
});
