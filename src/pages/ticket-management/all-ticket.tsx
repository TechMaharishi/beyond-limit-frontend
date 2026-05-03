import { useState, useEffect } from "react"
import { Search, Send } from "lucide-react"
import { cn, formatRelativeTime } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { apiClient } from "@/lib/api"
import { toast } from "sonner"
import { useDebounce } from "@/hooks/use-debounce"

interface User {
  _id: string
  name: string
  email: string
}

interface Ticket {
  _id: string
  user: User
  subject: string
  type: string
  description: string
  currentStatus: "pending" | "resolved"
  userId: string
  imageUrl?: string
  imageCloudinaryId?: string
  imageUrls?: string[]
  imageCloudinaryIds?: string[]
  videoUrls?: string[]
  videoCloudinaryIds?: string[]
  resolvedBy: string | null
  resolvedAt: string | null
  expireAt: string | null
  resolutionMsg: string
  createdAt: string
  updatedAt: string
  __v: number
}

interface TicketsResponse {
  success: boolean
  message: string
  data: Ticket[]
  meta: {
    page: number
    offset: number
    limit: number
    total: number
    hasNext: boolean
  }
}

interface SingleTicketResponse {
  success: boolean
  message: string
  data: Ticket
}

/** Ticket inbox and resolution dashboard. Implements virtualization, debounced search, and split-pane details. */
export default function AllTicketsPage() {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [resolutionMessage, setResolutionMessage] = useState("")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const queryClient = useQueryClient()

  const debouncedSearchQuery = useDebounce(searchQuery, 500)

  const { data, isLoading: isLoadingTickets } = useQuery({
    queryKey: ['tickets', page, limit, debouncedSearchQuery],
    queryFn: async () => {
      const params: Record<string, any> = { page, limit }
      if (debouncedSearchQuery) params.search = debouncedSearchQuery
      const response = await apiClient.get<TicketsResponse>('/support/tickets', { params })
      return response.data
    },
    placeholderData: keepPreviousData,
  })

  const allTickets = data?.data || []
  const meta = data?.meta

  const { data: selectedTicketData, isLoading: isLoadingSelected } = useQuery({
    queryKey: ['ticket', selectedTicketId],
    queryFn: async () => {
      if (!selectedTicketId) return null
      const response = await apiClient.get<SingleTicketResponse>(`/support/tickets/${selectedTicketId}`)
      return response.data
    },
    enabled: !!selectedTicketId
  })

  // Resolve mutation; on success updates both ticket list and selected ticket details.
  const resolveMutation = useMutation({
    mutationFn: async ({ id, message }: { id: string, message: string }) => {
      const response = await apiClient.post(`/support/tickets/${id}/resolve`, { message })
      return response.data
    },
    onSuccess: () => {
      toast.success("Ticket resolved successfully")
      setResolutionMessage("")
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['ticket', selectedTicketId] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to resolve ticket")
    }
  })

  useEffect(() => {
    if (allTickets.length > 0 && !selectedTicketId && !isLoadingTickets) {
      setSelectedTicketId(allTickets[0]._id)
    }
  }, [isLoadingTickets, allTickets, selectedTicketId])

  const handleResolveTicket = () => {
    if (!selectedTicketId || !resolutionMessage.trim()) return
    resolveMutation.mutate({ id: selectedTicketId, message: resolutionMessage })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20"
      case "resolved": return "bg-green-500/10 text-green-500 hover:bg-green-500/20"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const selectedTicket = selectedTicketData?.data
  const selectedTicketImageUrls = selectedTicket?.imageUrls?.length
    ? selectedTicket.imageUrls
    : selectedTicket?.imageUrl
      ? [selectedTicket.imageUrl]
      : []
  const selectedTicketVideoUrls = selectedTicket?.videoUrls || []

  return (
    <div className="flex h-[calc(100vh-8rem)] w-full bg-background border rounded-lg overflow-hidden shadow-sm">
      {/* Left Sidebar - Ticket List */}
      <div className="w-full md:w-[350px] lg:w-[400px] flex flex-col border-r bg-muted/10">
        <div className="p-4 border-b space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Inbox</h2>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tickets..."
              className="pl-8 bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoadingTickets ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div>
              {allTickets.map((ticket) => (
                <button
                  key={ticket._id}
                  onClick={() => setSelectedTicketId(ticket._id)}
                  className={cn(
                    "flex flex-col items-start gap-2 p-4 text-left text-sm transition-all hover:bg-accent w-full border-b",
                    selectedTicketId === ticket._id && "bg-accent"
                  )}
                >
                  <div className="flex w-full flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{ticket.user.name}</span>
                        {ticket.currentStatus === 'pending' && (
                          <span className="flex h-2 w-2 rounded-full bg-blue-600" />
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatRelativeTime(ticket.updatedAt)}
                      </span>
                    </div>
                    <span className="font-medium line-clamp-1">
                      {ticket.subject}
                    </span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {ticket.description}
                    </span>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className={cn("text-[10px] px-1 py-0 border-0", getStatusColor(ticket.currentStatus))}>
                        {ticket.currentStatus}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        {ticket.type}
                      </Badge>
                    </div>
                  </div>
                </button>
              ))}

              {allTickets.length === 0 && (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No tickets found matching your search.
                </div>
              )}
            </div>
          )}
        </div>
        {/* Fixed pagination footer (outside scroll container) */}
        <div className="p-2 border-t flex items-center justify-between">
          <div className="flex items-center space-x-2 mr-4">
            <span className="text-xs text-muted-foreground">Rows per page</span>
            <Select
              value={limit.toString()}
              onValueChange={(val) => {
                setLimit(Number(val))
                setPage(1)
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={limit} />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={(meta?.page || 1) <= 1 || isLoadingTickets}
          >
            Previous
          </Button>
          <div className="text-xs font-medium">
            Page {meta?.page || 1}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={!meta?.hasNext || isLoadingTickets}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Right Panel - Ticket Details */}
      {(selectedTicket || isLoadingSelected || isLoadingTickets || (allTickets.length > 0 && !selectedTicketId)) ? (
        <div className="flex flex-1 flex-col overflow-hidden bg-background">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b h-[60px]">
            {selectedTicket ? (
              <div className="flex items-center gap-4">
                <Avatar>
                  <AvatarFallback>{selectedTicket.user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold">{selectedTicket.user.name}</div>
                  <div className="text-xs text-muted-foreground">{selectedTicket.user.email}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-muted/50 animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-muted/50 rounded animate-pulse" />
                  <div className="h-3 w-48 bg-muted/50 rounded animate-pulse" />
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {!selectedTicket ? (
              <div className="space-y-4">
                <div className="h-8 w-1/3 bg-muted/50 rounded animate-pulse" />
                <div className="h-32 w-full bg-muted/50 rounded animate-pulse" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-4 w-full bg-muted/50 rounded animate-pulse" />
                  <div className="h-4 w-full bg-muted/50 rounded animate-pulse" />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <h1 className="text-2xl font-bold">{selectedTicket.subject}</h1>
                  <Badge variant="outline" className="text-sm">
                    {formatRelativeTime(selectedTicket.createdAt)}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                  <div>
                    <span className="font-medium text-foreground">Ticket ID:</span> {selectedTicket._id}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Type:</span> {selectedTicket.type}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Status:</span> <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium", getStatusColor(selectedTicket.currentStatus))}>{selectedTicket.currentStatus}</span>
                  </div>
                  {selectedTicket.resolvedAt && (
                    <div>
                      <span className="font-medium text-foreground">Resolved At:</span> {new Date(selectedTicket.resolvedAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                </div>

                <div className="prose prose-sm max-w-none text-foreground bg-muted/30 p-4 rounded-md">
                  <h3 className="text-sm font-semibold mb-2">Description</h3>
                  <p>{selectedTicket.description}</p>
                </div>

                {selectedTicket.resolutionMsg && (
                  <div className="bg-green-50 border border-green-100 p-4 rounded-md">
                    <h3 className="text-sm font-semibold text-green-800 mb-1">Resolution</h3>
                    <p className="text-green-700 text-sm">{selectedTicket.resolutionMsg}</p>
                  </div>
                )}

                {(selectedTicketImageUrls.length > 0 || selectedTicketVideoUrls.length > 0) && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Attachments</h4>
                    <div className="flex flex-wrap gap-4">
                      {selectedTicketImageUrls.map((url, index) => (
                        <div key={`image-${index}`} className="relative group overflow-hidden rounded-md border bg-muted">
                          <img
                            src={url}
                            alt={`Attachment ${index + 1}`}
                            className="h-48 w-auto object-cover transition-transform group-hover:scale-105"
                          />
                        </div>
                      ))}
                      {selectedTicketVideoUrls.map((url, index) => (
                        <div key={`video-${index}`} className="relative overflow-hidden rounded-md border bg-muted">
                          <video
                            src={url}
                            controls
                            className="h-48 w-auto max-w-full bg-black"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Fixed Input Area */}
          <div className="p-4 bg-background border-t">
            {selectedTicket ? (
              selectedTicket.currentStatus === 'resolved' ? (
                <div className="flex items-center justify-center p-4 bg-muted/20 rounded-lg border border-dashed">
                  <p className="text-muted-foreground text-sm flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                    This ticket has been resolved.
                  </p>
                </div>
              ) : selectedTicket.type === 'app-technical-support' ? (
                <div className="flex items-center justify-center p-4 bg-muted/20 rounded-lg border border-dashed">
                  <p className="text-muted-foreground text-sm flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                    App Technical Support tickets cannot be resolved from this interface.
                  </p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Type your resolution message here..."
                    value={resolutionMessage}
                    onChange={(e) => setResolutionMessage(e.target.value)}
                    className="min-h-[50px] resize-none"
                  />
                  <Button
                    onClick={handleResolveTicket}
                    disabled={!resolutionMessage.trim() || resolveMutation.isPending}
                    className="h-auto"
                  >
                    {resolveMutation.isPending ? "..." : <Send className="h-4 w-4" />}
                    <span className="sr-only">Resolve</span>
                  </Button>
                </div>
              )
            ) : (
              <div className="flex gap-2">
                <div className="w-full h-[50px] bg-muted/50 rounded animate-pulse" />
                <div className="h-[50px] w-[50px] bg-muted/50 rounded animate-pulse" />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center bg-muted/5 text-muted-foreground">
          <div className="text-center space-y-2">
            <div className="text-4xl">🎫</div>
            <h3 className="font-semibold text-lg">No ticket selected</h3>
            <p className="text-sm">Select a ticket from the list to view details</p>
          </div>
        </div>
      )}
    </div>
  )
}
