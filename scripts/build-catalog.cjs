// Rebuild the bundled offline catalog from reviewed factual records.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');global.window={};require('../dist/components.js');
const C=require('../dist/catalog-core.js'),P=require('../dist/component-packs.js'),defs=window.OPTICAL_COMPONENTS;
const read=name=>C.validate(JSON.parse(fs.readFileSync(path.join(root,'catalog',name),'utf8')),defs,P).records;
// The active catalog follows the user's four purchase documents. Earlier public
// research remains on disk, but is not bundled into the picker.
const records=read('lab-records.json');
const catalog={kind:'optical-bench-catalog',version:1,records};
fs.writeFileSync(path.join(root,'dist/catalog-data.js'),'window.OPTICAL_CATALOG = '+JSON.stringify(catalog,null,2)+';\n');
const counts={};for(const r of records){counts[r.vendor]??={};counts[r.vendor][r.baseType]=(counts[r.vendor][r.baseType]||0)+1;}
const sources=[...new Set(records.map(r=>r.source).filter(Boolean))].sort();
const documents=[...new Set(records.flatMap(r=>r.documents.map(s=>s.split(' · ')[0])))].sort();
fs.writeFileSync(path.join(root,'catalog/coverage.json'),JSON.stringify({checked:'2026-11-12',scope:'user-documents-optical-components',completeManufacturerCatalog:false,total:records.length,counts,documents,sources},null,2)+'\n');
console.log(JSON.stringify({total:records.length,counts},null,2));
