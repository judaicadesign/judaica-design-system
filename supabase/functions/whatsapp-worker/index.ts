import {quoteB612} from '../_shared/b612-core.ts';
import {createExtractor} from '../_shared/whatsapp-extract.mjs';
import {createWorker} from './handler.mjs';
import {createStore,createApproverSender} from './adapters.mjs';
const env=(name:string)=>Deno.env.get(name);
Deno.serve(createWorker({env,store:createStore({env}),extract:createExtractor({env}),quoteB612,send:createApproverSender({env})}));
