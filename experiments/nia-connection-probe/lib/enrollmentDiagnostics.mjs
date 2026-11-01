const phases=new Set(['bundle','database_url','google_client','prisma_import','jose_import','tls_ca','bind','handler']);
const nodeCodes=new Map([
 ['ENOENT','FILE_MISSING'],['ERR_MODULE_NOT_FOUND','MODULE_MISSING'],['MODULE_NOT_FOUND','MODULE_MISSING'],
 ['ERR_DLOPEN_FAILED','NATIVE_MODULE_LOAD_FAILED'],['ERR_PACKAGE_PATH_NOT_EXPORTED','PACKAGE_EXPORT_UNAVAILABLE']
]);
const bundleCodes=new Map([
 ['Reviewed Linux Prisma bundle unavailable','BUNDLE_PLATFORM_OR_READINESS'],
 ['Invalid server bundle manifest','BUNDLE_MANIFEST_INVALID'],
 ['Invalid bundle digest','BUNDLE_MANIFEST_INVALID'],['Server bundle digest mismatch','BUNDLE_DIGEST_MISMATCH']
]);
const defaults=Object.freeze({bundle:'BUNDLE_UNAVAILABLE',database_url:'QA_URL_REJECTED',google_client:'GOOGLE_CLIENT_REJECTED',
 prisma_import:'PRISMA_IMPORT_FAILED',jose_import:'JOSE_IMPORT_FAILED',tls_ca:'CA_VALIDATION_FAILED',bind:'BINDING_FAILED',handler:'HANDLER_UNAVAILABLE'});
/** Only constant codes can reach the sink. Never include message, stack, path,
 * request, env, identity, URL, token or an arbitrary error.code in a log record.
 */
export function reportEnrollmentFailure(phase,error,write=record=>console.error(JSON.stringify(record))){
 const safePhase=phases.has(phase)?phase:'handler';let code=defaults[safePhase];
 try{code=nodeCodes.get(error?.code)??(safePhase==='bundle'?bundleCodes.get(error?.message):undefined)??code}catch{code=defaults[safePhase]}
 const record=Object.freeze({event:'nia_owner_enrollment_unavailable',phase:safePhase,code});
 try{write(record)}catch{return record} // Logging failure must not alter the closed HTTP response.
 return record;
}
