import Link from "next/link"
import { Facebook, Instagram, Twitter, Mail, Phone } from "lucide-react"

export function Footer() {
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
              <li className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-4 h-4" />
                <a href="tel:+33123456789" className="hover:text-primary transition-colors">
                  +33 1 23 45 67 89
                </a>
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-4 h-4" />
                <a href="mailto:info@lestemples.fr" className="hover:text-primary transition-colors">
                  info@lestemples.fr
                </a>
              </li>
            </ul>
          </div>

          {/* Hours */}
          <div>
            <h4 className="font-semibold mb-4">Horaires</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>Lun - Ven : 10:00 - 20:00</li>
              <li>Sam : 09:00 - 21:00</li>
              <li>Dim : 10:00 - 19:00</li>
            </ul>
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
