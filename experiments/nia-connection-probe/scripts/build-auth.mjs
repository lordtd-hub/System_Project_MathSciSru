import {readFile,readdir,writeFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
import {resolve,join} from 'node:path';import {fileURLToPath} from 'node:url';
import {PRISMA_VERSION,ENGINE_REVISION,BINARY_TARGET,REQUIRED_ASSETS,validateBundleMetadata} from '../lib/prismaBundle.mjs';
import {QA_CA_PATH,verifyQaCertificate} from '../lib/qaTls.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
const EXPECTED_LOCK_SHA256='b8cddcc5393ad26e787431e3a30e6b4d2bee484b3577afa320e433eb735f44bc';
export function generationEnvironment(environment){
 const env={};for(const key of ['PATH','SystemRoot','WINDIR','TEMP','TMP','TMPDIR'])if(environment[key])env[key]=environment[key];
 return {...env,CI:'1',CHECKPOINT_DISABLE:'1',DO_NOT_TRACK:'1',PRISMA_HIDE_UPDATE_MESSAGE:'1',PRISMA_GENERATE_SKIP_AUTOINSTALL:'1',
  ASSISTANT_OAUTH_DATABASE_URL:'postgresql://PUBLIC_DUMMY:PUBLIC_DUMMY@127.0.0.1:1/postgres?schema=nia_oauth_race_validation'};
}
export async function inspectGenerated(root,{read=readFile,list=readdir,stat=lstat}={}){
 const base=join(root,'auth'),files=[];
 async function walk(relative){for(const entry of await list(join(base,relative),{withFileTypes:true})){const path=relative+'/'+entry.name;const info=await stat(join(base,path));if(info.isSymbolicLink())throw Error('Generated asset symlink is not permitted');if(info.isDirectory())await walk(path);else if(info.isFile()){if(/\.dll\.node$|\.exe$/.test(path))throw Error('Windows Prisma asset in Linux build');files.push({path,sha256:sha(await read(join(base,path)))})}}}
 await walk('generated/client');files.push({path:'prisma/schema.prisma',sha256:sha(await read(join(base,'prisma/schema.prisma')))});
 const ca=await read(join(base,QA_CA_PATH));verifyQaCertificate(ca);files.push({path:QA_CA_PATH,sha256:sha(ca)});files.sort((a,b)=>a.path.localeCompare(b.path));
 const index=await read(join(base,'generated/client/index.js'),'utf8');
 if(!index.includes(PRISMA_VERSION)||!index.includes(ENGINE_REVISION))throw Error('Generated client version/revision mismatch');
 const metadata={ready:true,platform:'linux',arch:'x64',clientVersion:PRISMA_VERSION,engineRevision:ENGINE_REVISION,binaryTarget:BINARY_TARGET,files};
 validateBundleMetadata(metadata,{platform:'linux',arch:'x64'});return metadata;
}
/** Build-only orchestration. Tests inject fake generator/assets; the live HTTP handler cannot call this. */
export async function buildAuth({root=fileURLToPath(new URL('../',import.meta.url)),environment=process.env,platform=process.platform,arch=process.arch,nodeMajor=Number(process.versions.node.split('.')[0]),openssl=process.versions.openssl,read=readFile,stat=lstat,generate,detectTarget,inspect=inspectGenerated,write=writeFile}={}){
 if(platform!=='linux'||arch!=='x64'||nodeMajor!==24||!openssl.startsWith('3.'))throw Error('Build requires Linux x64 Node24/OpenSSL3');
 if(environment.VERCEL_PROJECT_ID!=='prj_MPNUTjWygM12B3vu5u6mIoWfYUG4'||environment.VERCEL_GIT_COMMIT_REF!=='codex/nia-synthetic-api-proof'||!['production','preview'].includes(environment.VERCEL_ENV))throw Error('Wrong isolated project/branch build target');
 const lockText=await read(join(root,'package-lock.json'),'utf8');if(sha(lockText)!==EXPECTED_LOCK_SHA256)throw Error('Approved dependency lock changed');
 const lock=JSON.parse(lockText);if(Object.keys(lock.packages).length!==61)throw Error('Expected exact60-package graph');
 for(const path of ['.env','auth/.env','auth/prisma/.env']){try{await stat(join(root,path));throw Error('Unexpected local environment file')}catch(error){if(error.code!=='ENOENT')throw error}}
 verifyQaCertificate(await read(join(root,'auth',QA_CA_PATH)));
 const childEnv=generationEnvironment(environment);
 if(!detectTarget){const {default:platformModule}=await import('@prisma/get-platform');detectTarget=()=>platformModule.getBinaryTargetForCurrentPlatform()}
 if(await detectTarget()!==BINARY_TARGET)throw Error('Prisma Linux ABI target mismatch');
 const args=[join(root,'node_modules/prisma/build/index.js'),'generate','--schema',join(root,'auth/prisma/schema.prisma'),'--no-hints'];
 if(!generate)generate=async command=>{const r=spawnSync(process.execPath,command.args,{cwd:root,env:command.env,windowsHide:true,encoding:'utf8',timeout:60000,maxBuffer:1000000});if(r.status!==0)throw Error('Prisma generate failed; exit '+r.status+' '+(r.error?.code??''))};
 await generate({args,env:childEnv});
 const metadata=await inspect(root);validateBundleMetadata(metadata,{platform,arch});
 // Set readiness only after all generated files are present and hashed. No imports/connections to the auth runtime.
 await write(join(root,'auth/PRISMA_BUNDLE_READINESS.json'),JSON.stringify(metadata,null,2)+'\n');
 return{generated:true,clientVersion:PRISMA_VERSION,binaryTarget:BINARY_TARGET,assetCount:metadata.files.length,requiredAssets:REQUIRED_ASSETS.length,networkScope:'Public pinned Prisma engine downloads only; no Google/DB connection'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))buildAuth().then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1});
