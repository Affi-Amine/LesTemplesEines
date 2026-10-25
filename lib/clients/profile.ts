import { z } from "zod"
import { ClientDataSchema } from "@/lib/appointments/client-data"

const email = z.preprocess(value => typeof value === "string" ? value.trim().toLowerCase() || null : value,
  z.string().email("Saisissez une adresse email valide").max(255).nullable().optional())
const notes = z.preprocess(value => typeof value === "string" ? value.trim() || null : value,
  z.string().max(5000, "Les notes sont limitées à 5 000 caractères").nullable().optional())

export const ClientProfileFormSchema = z.object({
  first_name: ClientDataSchema.shape.first_name.max(100),
  last_name: ClientDataSchema.shape.last_name.max(100),
  phone: ClientDataSchema.shape.phone.refine(value => value.length <= 20, "Le numéro de téléphone est trop long"),
  email,
  internal_notes: notes,
}).strict()

export const ClientProfileUpdateSchema = ClientProfileFormSchema.partial().extend({
  expected_updated_at: z.string().datetime({ offset: true }).nullable().optional(),
}).strict().refine(value => Object.keys(value).some(key => key !== "expected_updated_at"), "Aucune modification transmise")

export function clientPhoneVariants(phone: string): string[] {
  const values = new Set([phone])
  const french = /^(?:0|\+33|0033|33)([1-9]\d{8})$/.exec(phone)
  if (french) for (const prefix of ["0", "+33", "0033", "33"]) values.add(prefix + french[1])
  return [...values]
}

export function clientSearchFilter(search: string): string | null {
  const terms = search.trim().slice(0, 200).split(/\s+/).filter(Boolean).slice(0, 8)
  if (!terms.length) return null
  const fields = ["first_name", "last_name", "phone", "email"]
  const groups = terms.map(term => {
    const pattern = JSON.stringify(`%${term.replace(/[\\%_]/g, character => `\\${character}`)}%`)
    return `or(${fields.map(field => `${field}.ilike.${pattern}`).join(",")})`
  })
  return `and(${groups.join(",")})`
}
