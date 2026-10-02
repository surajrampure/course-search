export const trustedCourseOrigins = ['https://math124.org', 'https://eecs245.org'];
export function validateConfigURL(value, pageURL) {
  const url = new URL(value || './config.json', pageURL);
  const page = new URL(pageURL);
  const local = ['127.0.0.1', 'localhost'].includes(page.hostname) && ['127.0.0.1', 'localhost'].includes(url.hostname);
  if (url.origin !== page.origin && !trustedCourseOrigins.includes(url.origin) && !local) throw Error('Unsupported course origin');
  return url;
}
export async function loadCourseConfig(pageURL = location.href, fetcher = fetch) {
  const configURL = validateConfigURL(new URL(pageURL).searchParams.get('config'), pageURL);
  const response = await fetcher(configURL.href);
  if (!response.ok) throw Error('Course configuration unavailable');
  const config = await response.json();
  const available = ['Lectures', 'Notes', 'Homeworks', 'Labs', 'Past exams'];
  if (typeof config.courseName !== 'string' || !config.categories?.length || config.categories.some(c => !available.includes(c))) throw Error('Invalid course configuration');
  const dataBase = new URL(config.dataBase || './data/', configURL);
  if (dataBase.origin !== configURL.origin) throw Error('Course data must share the configuration origin');
  return Object.freeze({...config, configURL: configURL.href, dataBase: dataBase.href, parentOrigin: configURL.origin});
}
