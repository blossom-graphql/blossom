import Koa from 'koa';
import koaCors from 'koa2-cors';
import koaBody from 'koa-bodyparser';

import router from './router';

// Create a new koa instance
const app = new Koa();

// -----------------------------------------------------------------------------
// This is the place to register your middleware
// -----------------------------------------------------------------------------

app.use(koaCors()); // CORS usage. Here you can configure it.
app.use(koaBody()); // Converts body to parsed and valid JSON. 400 otherwise.
app.use(router.routes()); // Registers the available routes and methods.
app.use(router.allowedMethods());

// Export the application
export default app;
