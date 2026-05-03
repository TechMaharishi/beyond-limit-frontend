import { useState, useRef, useEffect, useMemo } from "react"
import { useMutation } from "@tanstack/react-query"
import { apiClient } from "@/lib/api"
import { authClient } from "@/lib/auth-client"
import { toast } from "sonner"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Loader2, Upload, Trash2, CheckCircle2 } from "lucide-react"
import { getCountries, getCountryCallingCode, validatePhoneNumberLength, parsePhoneNumberFromString } from "libphonenumber-js"
import type { CountryCode } from "libphonenumber-js"

interface ProfileDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

interface UserData {
    id: string
    name: string
    email: string
    image: string
    role: "admin" | "trainer" | "trainee" | "user"
    emailVerified: boolean
    phone?: string
}

const roleMap = {
    admin: "Super Admin",
    trainer: "Training Admin",
    trainee: "Clinical Learners",
    user: "Individual Learners",
}

/**
 * Dialog for viewing and editing user profile details.
 * Supports updating personal info and profile picture management (upload/remove).
 */
export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [name, setName] = useState("")
    const [phone, setPhone] = useState("")
    const [country, setCountry] = useState<CountryCode>("AU")
    const [phoneError, setPhoneError] = useState<string | null>(null)

    const { data: session, isPending: isLoading, refetch: refetchSession } = authClient.useSession()
    const userData = session?.user as unknown as UserData | undefined

    // Sync local state with session data when dialog opens.
    useEffect(() => {
        if (userData && open) {
            setName(userData.name)
            if (userData.phone) {
                const parsed = parsePhoneNumberFromString(userData.phone)
                if (parsed && parsed.country) {
                    setCountry(parsed.country)
                    setPhone(parsed.format("NATIONAL").replace(/\D/g, ""))
                } else {
                    setPhone(userData.phone)
                }
            } else {
                setPhone("")
            }
        }
    }, [userData, open])

    const updateInfoMutation = useMutation({
        mutationFn: async (data: { name: string; phone: string }) => {
            const res = await apiClient.post("/update-account-info", data)
            return res.data
        },
        onSuccess: () => {
            refetchSession()
            toast.success("Profile information updated successfully.")
        },
        onError: (error: any) => {
             toast.error(error.response?.data?.message || "Failed to update profile.")
        },
    })

    const uploadPhotoMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData()
            formData.append("image", file)
            const res = await apiClient.post("/account/upload-profile-photo", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            })
            return res.data
        },
        onSuccess: () => {
            refetchSession()
            toast.success("Profile photo updated successfully.")
        },
        onError: (error: any) => {
             toast.error(error.response?.data?.message || "Failed to upload photo.")
        },
    })

    const removePhotoMutation = useMutation({
        mutationFn: async () => {
            const res = await apiClient.delete("/account/remove-profile-photo")
            return res.data
        },
        onSuccess: () => {
            refetchSession()
            toast.success("Profile photo removed.")
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || "Failed to remove photo.")
        },
    })

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            // Enforce 50MB limit to prevent server overload.
            if (file.size > 50 * 1024 * 1024) {
                toast.error("File size exceeds 50MB limit.")
                if (fileInputRef.current) {
                    fileInputRef.current.value = ""
                }
                return
            }
            uploadPhotoMutation.mutate(file)
        }
    }

    const handleSave = () => {
        const trimmedPhone = phone.trim()
        let formattedPhone = trimmedPhone
        
        if (trimmedPhone) {
            const validationError = validatePhoneNumberLength(trimmedPhone, country)
            if (validationError) {
                setPhoneError("Invalid phone number length.")
                return
            }

            const parsed = parsePhoneNumberFromString(trimmedPhone, country)
            if (parsed) {
                formattedPhone = parsed.format('E.164')
            } else {
                setPhoneError("Invalid phone number format.")
                return
            }
        }
        setPhoneError(null)
        updateInfoMutation.mutate({ name: name.trim(), phone: formattedPhone })
    }

    // Generate initials for avatar fallback (first two words).
    const initials = userData?.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "??"

    const countrySelectItems = useMemo(() => {
        return getCountries().map((countryCode) => (
            <SelectItem key={countryCode} value={countryCode}>
                {countryCode} (+{getCountryCallingCode(countryCode)})
            </SelectItem>
        ))
    }, [])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Profile Settings</DialogTitle>
                    <DialogDescription>
                        Manage your account settings
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="grid gap-6 py-4">
                        {/* Profile Picture Section */}
                        <div className="flex flex-col items-center gap-4">
                            <Avatar className="h-24 w-24">
                                <AvatarImage src={userData?.image || undefined} alt={userData?.name} />
                                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                            </Avatar>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploadPhotoMutation.isPending}
                                >
                                    {uploadPhotoMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Upload className="h-4 w-4" />
                                    )}
                                    Upload
                                </Button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                />
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="gap-2"
                                    onClick={() => removePhotoMutation.mutate()}
                                    disabled={removePhotoMutation.isPending || !userData?.image}
                                >
                                    {removePhotoMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-4 w-4" />
                                    )}
                                    Remove
                                </Button>
                            </div>
                        </div>

                        {/* User Info Section */}
                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email</Label>
                                <div className="relative">
                                    <Input id="email" value={userData?.email} disabled className="pr-10" />
                                    {userData?.emailVerified && (
                                        <div className="absolute right-3 top-2.5 text-green-500" title="Email Verified">
                                            <CheckCircle2 className="h-5 w-5" />
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="grid gap-2">
                                <Label htmlFor="role">Role</Label>
                                <div className="flex items-center">
                                    <Badge variant="secondary" className="px-3 py-1">
                                        {userData?.role ? roleMap[userData.role] : "User"}
                                    </Badge>
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="name">Full Name</Label>
                                <Input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <div className="flex gap-2">
                                    <Select value={country} onValueChange={(value: CountryCode) => setCountry(value)}>
                                        <SelectTrigger className="w-[110px]">
                                            <SelectValue placeholder="Country" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {countrySelectItems}
                                        </SelectContent>
                                    </Select>
                                    <Input
                                        id="phone"
                                        value={phone}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (/^\d*$/.test(value)) {
                                                setPhone(value);
                                                setPhoneError(null);
                                            }
                                        }}
                                        placeholder="Enter phone number"
                                    />
                                </div>
                                {phoneError && <p className="text-[0.8rem] text-destructive">{phoneError}</p>}
                            </div>
                        </div>


                    </div>
                )}

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleSave} disabled={updateInfoMutation.isPending || isLoading}>
                        {updateInfoMutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
