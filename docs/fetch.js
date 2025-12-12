// Small fetch helper that includes credentials for session cookies
async function apiFetch(input, init = {}) {
  const options = Object.assign({
    credentials: 'include'
  }, init);

  // Default JSON headers when body is an object
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    options.headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    options.body = JSON.stringify(options.body);
  }

  const res = await fetch(input, options);
  return res;
}