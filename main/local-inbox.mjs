import {app} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import {localInboxDefaults} from './local-inbox-profile.mjs';

app.setName('Agent Inbox');
const userData=path.join(app.getPath('appData'),'Agent Inbox');
app.setPath('userData',userData);
fs.mkdirSync(userData,{recursive:true});
// Exclusive creation preserves an existing inbox and its settings on rebuild.
try {
 fs.writeFileSync(path.join(userData,'zero.config.json'),JSON.stringify(localInboxDefaults(userData),null,2)+'\n',{flag:'wx',mode:0o600});
} catch(error) {if(error.code!=='EEXIST')throw error;}
process.env.AGENT_INBOX_LOCAL_BUILD='1';
await import('./main.mjs');
