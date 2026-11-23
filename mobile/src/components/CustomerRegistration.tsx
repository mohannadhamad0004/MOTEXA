import {useRef,useState} from 'react';
import {router} from 'expo-router';
import MechanicType from './MechanicType';
import {useMechanicTheme} from './MechanicUI';
import OwnerAuthLayout from './OwnerAuthLayout';
import {mechanicApi,MechanicApiError} from './mechanic-api';
export default function CustomerRegistration(){return <MechanicType><Registration/></MechanicType>;}
function Registration(){
 const m=useMechanicTheme(),[name,setName]=useState(''),[phone,setPhone]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),working=useRef(false);
 async function create(){if(working.current)return;setError('');if(name.trim().length<2||!email.trim()||!/^\+?[\d\s()-]{8,30}$/.test(phone.trim())||password.length<10||!/[a-z]/i.test(password)||!/[0-9]/.test(password)||password!==confirm){setError(m.t('Complete your name, phone number and email. Use matching passwords with at least 10 characters, letters and numbers.','أكمل الاسم ورقم الجوال والبريد. استخدم كلمة مرور من 10 أحرف على الأقل تضم حروفًا وأرقامًا وطابق التأكيد.'));return;}working.current=true;setBusy(true);try{await mechanicApi('/api/customer/register','POST',{fullName:name,phoneNumber:phone,email,password},true);router.replace({pathname:'/auth/login',params:{selectedRole:'customer',registered:'1'}});}catch(e){setError(e instanceof MechanicApiError&&e.status===409?m.t('An account already uses this email. Sign in or recover your account.','البريد مستخدم بحساب آخر. سجّل الدخول أو استعد حسابك.'):e instanceof MechanicApiError&&e.status===400?m.t('Review your name, email, mobile number and password.','راجع الاسم والبريد ورقم الجوال وكلمة المرور.'):m.t('Could not create your account. Check your connection and try again.','تعذر إنشاء حسابك. تحقق من الاتصال وحاول مجددًا.'));}finally{working.current=false;setBusy(false);}}
 return <OwnerAuthLayout mode="signup" fields={{name,phone,email,password,confirm}} onChange={(field,value)=>{if(field==='name')setName(value);else if(field==='phone')setPhone(value);else if(field==='email')setEmail(value);else if(field==='password')setPassword(value);else setConfirm(value);}} busy={busy} error={error} onSubmit={()=>void create()} onSwitch={()=>router.replace({pathname:'/auth/login',params:{selectedRole:'customer'}})}/>;
}
