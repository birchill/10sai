import UAParser from 'ua-parser-js';

const parser = new UAParser();
const os = parser.getOS();

export const isWindows = os.name === 'Windows';
export const isMac = os.name === 'Mac OS';
export const isIOS = os.name === 'iOS';
