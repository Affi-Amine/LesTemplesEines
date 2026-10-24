import { z } from "zod"

export const ClientDataSchema = z.object({
  first_name: z.string().trim().min(1, "Le prénom est requis"),
  last_name: z.string().trim().min(1, "Le nom est requis"),
  phone: z.string().transform(value => value.replace(/[\s\u00A0\-\.\(\)\/]/g, ""))
    .refine(value => /^\+?[0-9]{9,}$/.test(value), { message: "Saisissez un numéro de téléphone valide" }),
  email: z.string().trim().email("Saisissez une adresse email valide").optional(),
})
