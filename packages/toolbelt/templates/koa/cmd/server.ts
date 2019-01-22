import app from 'lib/server/app';

// This is actually importing blossom/index.ts in your project directory.
// This file automatically loads all components for you and registers the
// /graphql route in your server.
import 'blossom';

// Extract environment params
const PORT = process.env.PORT || 3000;

// Start the web server
app.listen(PORT);
console.log(`App listening on port ${PORT}.`);
