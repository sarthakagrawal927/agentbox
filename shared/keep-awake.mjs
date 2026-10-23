import {z} from 'zod';

export const awakeCommand=z.discriminatedUnion('action',[
 z.object({action:z.literal('status')}),
 z.object({action:z.literal('setup')}),
 z.object({action:z.literal('start'),minutes:z.number().int().min(1).max(43200)}),
 z.object({action:z.literal('extend'),minutes:z.number().int().min(1).max(43200)}),
 z.object({action:z.literal('end')}),
 z.object({action:z.literal('quit')}),
]);
const warnings=z.array(z.string());
export const awakeState=z.discriminatedUnion('phase',[
 z.object({phase:z.literal('idle'),endsAt:z.null(),warnings}),
 z.object({phase:z.literal('active'),endsAt:z.number().finite(),warnings}),
 z.object({phase:z.literal('recovery'),endsAt:z.number().finite().nullable(),warnings}),
 z.object({phase:z.literal('unsupported'),message:z.string()}),
 z.object({phase:z.literal('setup'),message:z.string()}),
 z.object({phase:z.literal('unavailable'),message:z.string()}),
]);
export const awakeReply=z.discriminatedUnion('ok',[
 z.object({id:z.number().int(),ok:z.literal(true),state:awakeState}),
 z.object({id:z.number().int(),ok:z.literal(false),error:z.string(),state:awakeState}),
]);
