"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Briefcase,
  Edit,
  Save,
  X
} from "lucide-react"

interface StaffProfile {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  role: string
  salon_id: string
  salons?: {
    name: string
    city: string
    address: string
  }
}

export default function EmployeeProfilePage() {
  const [profile, setProfile] = useState<StaffProfile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editedProfile, setEditedProfile] = useState<Partial<StaffProfile>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const user = localStorage.getItem("adminUser")
    if (user) {
      const userData = JSON.parse(user)
      setProfile(userData)
      setEditedProfile(userData)
    }
    setIsLoading(false)
  }, [])

  const handleEdit = () => {
    setIsEditing(true)
    setEditedProfile(profile || {})
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditedProfile(profile || {})
  }

  const handleSave = async () => {
    // In a real app, you would make an API call to update the profile
    // For now, we'll just update the local state and localStorage
    if (profile && editedProfile) {
      const updatedProfile = { ...profile, ...editedProfile }
      setProfile(updatedProfile)
      localStorage.setItem("adminUser", JSON.stringify(updatedProfile))
      setIsEditing(false)
    }
  }

  const handleInputChange = (field: keyof StaffProfile, value: string) => {
    setEditedProfile(prev => ({ ...prev, [field]: value }))
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-100 text-purple-800 border-purple-200"
      case "manager":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "therapist":
        return "bg-green-100 text-green-800 border-green-200"
      case "assistant":
        return "bg-orange-100 text-orange-800 border-orange-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading profile...</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-red-600">Profile not found</div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <User className="h-6 w-6" />
          <h1 className="text-2xl font-bold">My Profile</h1>
        </div>
        {!isEditing ? (
          <Button onClick={handleEdit} className="flex items-center gap-2 w-full sm:w-auto">
            <Edit className="h-4 w-4" />
            Edit Profile
          </Button>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button onClick={handleSave} className="flex items-center gap-2 justify-center">
              <Save className="h-4 w-4" />
              Save
            </Button>
            <Button variant="outline" onClick={handleCancel} className="flex items-center gap-2 justify-center">
              <X className="h-4 w-4" />
              Cancel
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Personal Information */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name" className="text-sm font-medium">First Name</Label>
                {isEditing ? (
                  <Input
                    id="first_name"
                    value={editedProfile.first_name || ""}
                    onChange={(e) => handleInputChange("first_name", e.target.value)}
                    className="w-full"
                  />
                ) : (
                  <p className="text-sm font-medium py-2 px-3 bg-gray-50 rounded-md">
                    {profile.first_name}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name" className="text-sm font-medium">Last Name</Label>
                {isEditing ? (
                  <Input
                    id="last_name"
                    value={editedProfile.last_name || ""}
                    onChange={(e) => handleInputChange("last_name", e.target.value)}
                    className="w-full"
                  />
                ) : (
                  <p className="text-sm font-medium py-2 px-3 bg-gray-50 rounded-md">
                    {profile.last_name}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-500 flex-shrink-0" />
                {isEditing ? (
                  <Input
                    id="email"
                    type="email"
                    value={editedProfile.email || ""}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className="flex-1"
                  />
                ) : (
                  <span className="text-sm py-2 px-3 bg-gray-50 rounded-md flex-1 min-w-0 break-all">
                    {profile.email}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">Phone</Label>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-500 flex-shrink-0" />
                {isEditing ? (
                  <Input
                    id="phone"
                    value={editedProfile.phone || ""}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    className="flex-1"
                  />
                ) : (
                  <span className="text-sm py-2 px-3 bg-gray-50 rounded-md flex-1">
                    {profile.phone}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Work Information */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Briefcase className="h-5 w-5" />
              Work Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Role</Label>
              <Badge className={`${getRoleColor(profile.role)} w-fit`}>
                {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
              </Badge>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-sm font-medium">Workplace</Label>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm min-w-0 flex-1">
                  {profile.salons ? (
                    <div className="space-y-1">
                      <p className="font-medium">{profile.salons.name}</p>
                      <p className="text-gray-600 break-words">{profile.salons.address}</p>
                      <p className="text-gray-600">{profile.salons.city}</p>
                    </div>
                  ) : (
                    <p className="text-gray-600">Salon information not available</p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-sm font-medium">Employee ID</Label>
              <div className="text-xs sm:text-sm font-mono bg-gray-50 p-3 rounded-md break-all">
                {profile.id}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Settings */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Account Settings</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="space-y-4">
            <Button variant="outline" className="w-full sm:w-auto">
              Change Password
            </Button>
            <div className="text-xs sm:text-sm text-gray-600">
              <p>For security reasons, password changes require verification.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}