import Dexie from 'dexie';

export const db = new Dexie('HarmonizationHelper')
db.version(1).stores({
    analyses: 'id, analysis'

})