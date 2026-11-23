import * as Store from './SessionStore';
import {mechanicApi} from './mechanic-api';
/** Always verifies the existing session with the backend; never trusts a client role claim. */
export async function hasOwnerSession(){try{const token=await Store.getItemAsync('motexa_access_token');if(!token)return false;const data=await mechanicApi<{user:{role:string;status:string}}>('/api/auth/me');return data.user.role==='CUSTOMER'&&data.user.status==='ACTIVE';}catch{return false;}}
