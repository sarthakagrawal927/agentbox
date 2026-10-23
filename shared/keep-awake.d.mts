import type {z} from 'zod';
export const awakeCommand:z.ZodType<
 {action:'status'|'setup'|'end'|'quit'}|{action:'start'|'extend';minutes:number}
>;
export type AwakeCommand=z.infer<typeof awakeCommand>;
export type AwakeState=
 |{phase:'idle';endsAt:null;warnings:string[]}
 |{phase:'active';endsAt:number;warnings:string[]}
 |{phase:'recovery';endsAt:number|null;warnings:string[]}
 |{phase:'unsupported'|'setup'|'unavailable';message:string};
export type AwakeResult={ok:true;state:AwakeState}|{ok:false;error:string;state:AwakeState};
export const awakeState:z.ZodType<AwakeState>;
export const awakeReply:z.ZodType<AwakeResult & {id:number}>;
