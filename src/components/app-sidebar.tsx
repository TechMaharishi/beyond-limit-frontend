import { authClient } from "@/lib/auth-client"
import {
    Home,   
    Library,
    Users,
    Ticket,
    PlusCircle,
    ChevronRight,
    BookOpen,
    Video,
    type LucideIcon
} from "lucide-react"
import { Link } from "react-router-dom"
import logo from "@/assets/logo.png"
import { Spinner } from "./ui/spinner"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { NavUser } from "./nav-user"

import { getRolePath, filterMenuItemsByRole, getRoleHomePath } from "@/lib/utils"

/** Structure for sidebar navigation items. Supports recursive nesting. */
type MenuItem = {
    title: string
    url?: string
    icon?: LucideIcon
    items?: MenuItem[]
}

/**
 * Generates navigation items based on the user's role path.
 * Dynamically constructs URLs to ensure users stay within their role-scoped routes.
 */
const getMenuItems = (rolePath: string): MenuItem[] => [
    {
        title: "Dashboard",
        url: `/${rolePath}/dashboard`,
        icon: Home,
    },
    {
        title: "Content Management",
        icon: Library,
        items: [
            { title: "Short Videos", url: `/${rolePath}/content/shorts` },
            { title: "Courses", url: `/${rolePath}/content/courses` },
            {
                title: "Reviews",
                items: [
                    { title: "Pending Shorts", url: `/${rolePath}/content/reviews/shorts` },
                    { title: "Pending Courses", url: `/${rolePath}/content/reviews/courses` },
                ]
            },
            {
                title: "Drafts",
                items: [
                    { title: "Draft Shorts", url: `/${rolePath}/content/drafts/shorts` },
                    { title: "Draft Courses", url: `/${rolePath}/content/drafts/courses` },
                ]
            },
            { title: "Learning Areas", url: `/${rolePath}/content/tags` },
        ]
    },
    {
        title: "Assign Courses",
        url: `/${rolePath}/users/assignments/courses`,
        icon: BookOpen,
    },
    {
        title: "Assign Shorts",
        url: `/${rolePath}/users/assignments/shorts`,
        icon: Video,
    },
    {
        title: "User Management",
        icon: Users,
        items: [
            { title: "All Users", url: `/${rolePath}/users/all` },
            {
                title: "Assignments",
                items: [
                    { title: "Assign Courses", url: `/${rolePath}/users/assignments/courses` },
                    { title: "Assign Shorts", url: `/${rolePath}/users/assignments/shorts` },
                    { title: "Assign Clinicians", url: `/${rolePath}/users/assignments/clinical` },
                ]
            }
        ]
    },
    {
        title: "Ticket Management",
        icon: Ticket,
        items: [
            { title: "All Tickets", url: `/${rolePath}/tickets/all` },
            { title: "Ticket Types", url: `/${rolePath}/tickets/types` },
        ]
    },
    {
        title: "Create Ticket",
        icon: PlusCircle,
        url: `/${rolePath}/tickets/create`,
    }
]

/**
 * Main application sidebar.
 * Handles user session state to determine the correct role-based navigation links.
 * Displays a loading spinner while the session is initializing.
 */
export function AppSidebar() {
    const { data: session, isPending } = authClient.useSession()
    const sessionUser = session?.user as
        | { role?: string; name?: string; email?: string; image?: string }
        | undefined
    
    const user = {
        name: sessionUser?.name || "",
        email: sessionUser?.email || "",
        avatar: sessionUser?.image || "",
    }

    // Default to "app" if role is undefined, though typical flow ensures a role exists.
    const role = sessionUser?.role || "user"
    const rolePath = sessionUser ? getRolePath(role) : "app";
    const items = filterMenuItemsByRole(role, getMenuItems(rolePath));
    const homeLink = sessionUser ? getRoleHomePath(role) : `/${rolePath}/dashboard`;

    return (
        <Sidebar>
            <SidebarHeader className="flex items-center justify-center border-b border-sidebar-border">
                <Link to={homeLink}>
                    <img src={logo} alt="Beyond Limit Logo" className="w-full h-30" />
                </Link>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {items.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    {item.items ? (
                                        <Collapsible className="group/collapsible" defaultOpen>
                                            <CollapsibleTrigger asChild>
                                                <SidebarMenuButton className="font-semibold text-sidebar-foreground">
                                                    {item.icon && <item.icon />}
                                                    <span>{item.title}</span>
                                                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                                </SidebarMenuButton>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent>
                                                <SidebarMenuSub>
                                                    {item.items.map((subItem) => (
                                                        <SubMenuItem key={subItem.title} item={subItem} />
                                                    ))}
                                                </SidebarMenuSub>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    ) : (
                                        <SidebarMenuButton asChild className="font-semibold text-sidebar-foreground">
                                            <Link to={item.url!}>
                                                {item.icon && <item.icon />}
                                                <span>{item.title}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    )}
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter className="border-t border-sidebar-border p-4">
                {isPending ? (
                    <div className="flex justify-center p-2">
                        <Spinner />
                    </div>
                ) : (
                    <NavUser user={user} />
                )}
            </SidebarFooter>
        </Sidebar>
    )
}

/**
 * Recursive component for rendering nested menu items.
 * Uses Collapsible for submenus and Link for leaf nodes.
 */
function SubMenuItem({ item }: { item: MenuItem }) {
    if (item.items) {
        return (
            <SidebarMenuSubItem>
                <Collapsible className="group/collapsible" defaultOpen>
                    <CollapsibleTrigger asChild>
                        <SidebarMenuSubButton className="font-medium">
                            <span>{item.title}</span>
                            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuSubButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <SidebarMenuSub>
                            {item.items.map((subItem) => (
                                <SubMenuItem key={subItem.title} item={subItem} />
                            ))}
                        </SidebarMenuSub>
                    </CollapsibleContent>
                </Collapsible>
            </SidebarMenuSubItem>
        )
    }

    return (
        <SidebarMenuSubItem>
            <SidebarMenuSubButton asChild>
                <Link to={item.url!}>
                    <span>{item.title}</span>
                </Link>
            </SidebarMenuSubButton>
        </SidebarMenuSubItem>
    )
}
