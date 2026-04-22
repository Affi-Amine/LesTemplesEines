"use client"

import Link from "next/link"
import { Facebook, Instagram, Twitter, Mail, Phone } from "lucide-react"
import { useSalons } from "@/lib/hooks/use-salons"

export function Footer() {
  const { data: salons } = useSalons()
  const primaryPhone = salons?.find((salon) => salon.phone)?.phone
  const primaryEmail = salons?.find((salon) => salon.email)?.email

  return (
    <footer id="contact" className="border-t bg-card">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div>
            <h3 className="text-lg font-bold text-primary mb-4">Les Temples</h3>
            <p className="text-sm text-muted-foreground">Maisons de massage inspirées de la Thaïlande, au style sobre et raffiné.</p>
            <div className="flex gap-4 mt-4">
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-4">Liens rapides</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
                  Accueil
                </Link>
              </li>
              <li>
                <Link href="/book" className="text-muted-foreground hover:text-primary transition-colors">
                  Réserver
                </Link>
              </li>
              <li>
                <Link href="/nos-temples" className="text-muted-foreground hover:text-primary transition-colors">
                  Nos temples
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-muted-foreground hover:text-primary transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/admin" className="text-muted-foreground hover:text-primary transition-colors">
                  Administration
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-sm">
              {primaryPhone ? (
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  <a href={`tel:${primaryPhone}`} className="hover:text-primary transition-colors">
                    {primaryPhone}
                  </a>
                </li>
              ) : null}
              {primaryEmail ? (
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  <a href={`mailto:${primaryEmail}`} className="hover:text-primary transition-colors">
                    {primaryEmail}
                  </a>
                </li>
              ) : null}
              <li className="text-muted-foreground">
                <Link href="/contact" className="hover:text-primary transition-colors">
                  Voir toutes les coordonnées
                </Link>
              </li>
            </ul>
          </div>

          {/* Hours */}
          <div>
            <h4 className="font-semibold mb-4">Horaires</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Les horaires varient selon chaque temple.</p>
              <Link href="/contact" className="hover:text-primary transition-colors">
                Consulter les horaires par adresse
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t pt-8 flex flex-col gap-4 text-center text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:text-left">
          <p>&copy; 2025 Les Temples. Tous droits réservés.</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center md:justify-end md:gap-6">
            <Link href="#" className="hover:text-primary transition-colors">
              Politique de confidentialité
            </Link>
            <Link href="#" className="hover:text-primary transition-colors">
              Conditions d’utilisation
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
