import {readFile} from 'node:fs/promises';
import {createHash,X509Certificate} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validDedicatedQaUrl} from './hostPolicy.js';
export const QA_CA_PATH='certs/supabase-root-2021.crt';
export const QA_CA_SHA256='700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7';
export const QA_CA_DER_SHA256='807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa';
/** Existing public CA only; no downloads, trust-store import or peer handshake. */
export function verifyQaCertificate(bytes,now=Date.now()){
 const text=Buffer.from(bytes).toString('ascii');
 if(!Number.isFinite(now)||createHash('sha256').update(bytes).digest('hex')!==QA_CA_SHA256||text.includes('PRIVATE KEY')||(text.match(/-----BEGIN CERTIFICATE-----/g)??[]).length!==1)throw Error('Reviewed QA CA unavailable');
 const cert=new X509Certificate(bytes);
 if(!cert.ca||!cert.checkIssued(cert)||!cert.verify(cert.publicKey)||createHash('sha256').update(cert.raw).digest('hex')!==QA_CA_DER_SHA256||Date.parse(cert.validFrom)>now||Date.parse(cert.validTo)<=now)throw Error('Reviewed QA CA unavailable');
 return true;
}
/** Input is a private URL whose exact host/user/query have already been approved.
 * Only this constant, local, hash-verified public CA path is appended. Caller
 * cannot supply sslcert/rootcert/identity, a different host or a TLS bypass.
 * Native Prisma validates the peer hostname via sslaccept=strict at connection.
 * This adds a per-connection CA, not an exclusive server-certificate pin.
 */
export async function createPinnedQaConnection(value,{base=new URL('../auth/',import.meta.url),read=readFile,now=Date.now()}={}){
 if(!validDedicatedQaUrl(value))throw Error('Dedicated QA connection unavailable');
 const certUrl=new URL(QA_CA_PATH,base);verifyQaCertificate(await read(certUrl),now);
 const result=new URL(value);result.searchParams.set('sslcert',fileURLToPath(certUrl));
 return result.href;
}
