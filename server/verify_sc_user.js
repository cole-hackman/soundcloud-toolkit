
import { soundcloudClient } from './server/lib/soundcloud-client.js';

async function main() {
  try {
    // Resolve a known popular user to see their data
    // "soundcloud" is a user
    const user = await soundcloudClient.resolvePublic('https://soundcloud.com/soundcloud');
    console.log('Keys available on user object:', Object.keys(user));
    console.log('last_modified:', user.last_modified);
    console.log('reposts_count:', user.reposts_count);
    console.log('Sample Data:', JSON.stringify(user, null, 2));
  } catch (error) {
    console.error(error);
  }
}

main();
