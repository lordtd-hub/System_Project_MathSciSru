import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
export const PRISMA_VERSION='6.19.3';
export const ENGINE_REVISION='c2990dca591cba766e3b7ef5d9e8a84796e47ab7';
export const BINARY_TARGET='rhel-openssl-3.0.x';
export const REQUIRED_ASSETS=Object.freeze(['generated/client/index.js','generated/client/package.json','generated/client/schema.prisma','generated/client/runtime/library.js','generated/client/libquery_engine-'+BINARY_TARGET+'.so.node','prisma/schema.prisma']);
export function validateBundleMetadata(metadata,{platform=process.platform,arch=process.arch}={}){
 if(metadata.ready!==true||platform!=='linux'||arch!=='x64'||metadata.platform!==platform||metadata.arch!==arch||metadata.clientVersion!==PRISMA_VERSION||metadata.engineRevision!==ENGINE_REVISION||metadata.binaryTarget!==BINARY_TARGET||!Array.isArray(metadata.files))throw Error('Reviewed Linux Prisma bundle unavailable');
 const paths=metadata.files.map(f=>f.path);
 if(new Set(paths).size!==paths.length||REQUIRED_ASSETS.some(path=>!paths.includes(path)))throw Error('Invalid server bundle manifest');
 for(const file of metadata.files){
  if(typeof file.path!=='string'||!(/^(?:generated\/client\/)[A-Za-z0-9_./-]+$/.test(file.path)||file.path==='prisma/schema.prisma')||file.path.split('/').some(part=>!part||part==='.'||part==='..')||/\.(?:dll|exe)(?:\.|$)/i.test(file.path)||!/^[a-f0-9]{64}$/.test(file.sha256))throw Error('Invalid server bundle manifest');
 }
 return metadata;
}
/** Validates the reviewed build's exact local assets; it never downloads or runs an engine. */
export async function assertServerPrismaBundle({base=new URL('../auth/',import.meta.url),platform=process.platform,arch=process.arch,read=readFile}={}){
 const metadata=validateBundleMetadata(JSON.parse(await read(new URL('PRISMA_BUNDLE_READINESS.json',base),'utf8')),{platform,arch});
 for(const file of metadata.files){
  if(!/^[a-f0-9]{64}$/.test(file.sha256))throw Error('Invalid bundle digest');
  const bytes=await read(new URL(file.path,base));
  if(createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error('Server bundle digest mismatch');
 }
 return metadata;
}
