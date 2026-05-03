import { Loader2, CheckCircle2, XCircle, Clock, RefreshCw, Captions } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

type SubtitleStatus = 'pending' | 'processing' | 'completed' | 'failed' | undefined;

interface SubtitleStatusCardProps {
    /** The current subtitle pipeline status from the API */
    status: SubtitleStatus;
    /** Failure reason string, shown only when status === 'failed' */
    failureReason?: string | null;
    /** How many times generation has been attempted */
    retryCount?: number;
    /** Timestamp of last attempt */
    lastAttempt?: string | null;
    /** Whether a retry is allowed */
    retryable?: boolean;
    /** Whether the subtitle URL is available for playback */
    hasSubtitleUrl?: boolean;
    /** Whether the retry API call is currently in flight */
    isRetrying: boolean;
    /** Only shown when shortId exists (edit mode) */
    shortId?: string;
    /** Called when the user clicks "Generate / Retry Subtitles" */
    onRetry: () => void;
    /** Only admins can trigger subtitle generation — hides the button for other roles */
    isAdmin?: boolean;
    /** 'default' shows a full Card, 'slim' shows a compact row for dialogs */
    variant?: 'default' | 'slim';
}

const STATUS_CONFIG: Record<
    NonNullable<SubtitleStatus>,
    { label: string; icon: React.ReactNode; badgeClass: string; description: string }
> = {
    pending: {
        label: 'Pending',
        icon: <Clock className="h-4 w-4 text-amber-500" />,
        badgeClass: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400',
        description: 'Subtitle generation is queued and will begin shortly.',
    },
    processing: {
        label: 'Processing',
        icon: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
        badgeClass: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400',
        description: 'AI transcription is running. This usually takes 1–5 minutes.',
    },
    completed: {
        label: 'Ready',
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
        badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400',
        description: 'Subtitles have been generated and are available for playback.',
    },
    failed: {
        label: 'Failed',
        icon: <XCircle className="h-4 w-4 text-destructive" />,
        badgeClass: 'bg-destructive/10 text-destructive border-destructive/20',
        description: 'Subtitle generation failed. You can retry below.',
    },
};

function formatRelative(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

export function SubtitleStatusCard({
    status,
    failureReason,
    retryCount,
    lastAttempt,
    retryable,
    hasSubtitleUrl,
    isRetrying,
    onRetry,
    isAdmin,
    variant = 'default',
}: SubtitleStatusCardProps) {
    const cfg = status ? STATUS_CONFIG[status] : null;
    const isProcessing = status === 'processing';
    const canRetry = !isProcessing && retryable !== false;

    if (variant === 'slim') {
        return (
            <div className="flex flex-col gap-2 border-t pt-4">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subtitles</span>
                            {cfg ? (
                                <Badge
                                    variant="outline"
                                    className={`flex items-center gap-1.5 h-5 px-1.5 text-[10px] uppercase font-bold border-transparent ${cfg.badgeClass}`}
                                >
                                    {cfg.icon}
                                    {cfg.label}
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase font-bold text-muted-foreground">
                                    Not started
                                </Badge>
                            )}
                        </div>
                        {status === 'failed' && failureReason && (
                            <p className="text-[10px] text-destructive line-clamp-1 italic">
                                {failureReason}
                            </p>
                        )}
                        {status === 'completed' && !hasSubtitleUrl && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 italic">
                                Propagating track...
                            </p>
                        )}
                    </div>

                    {isAdmin && (
                        <Button
                            variant={status === 'completed' ? 'secondary' : 'default'}
                            size="sm"
                            className="h-8 px-3 text-xs gap-2"
                            onClick={onRetry}
                            disabled={isRetrying || !canRetry}
                        >
                            {isRetrying ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <RefreshCw className="h-3 w-3" />
                            )}
                            {isRetrying
                                ? 'Queuing…'
                                : isProcessing
                                ? 'Processing…'
                                : status === 'completed'
                                ? 'Regenerate'
                                : 'Generate'}
                        </Button>
                    )}
                </div>
                
                {/* Micro-meta row */}
                {(retryCount !== undefined && retryCount > 0 || lastAttempt) && (
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60 px-0.5">
                        {retryCount !== undefined && retryCount > 0 && (
                            <span>{retryCount} attempt{retryCount !== 1 ? 's' : ''}</span>
                        )}
                        {lastAttempt && (
                            <span>Last: {formatRelative(lastAttempt)}</span>
                        )}
                    </div>
                )}
            </div>
        );
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Captions className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-base">Subtitles</CardTitle>
                    </div>
                    {cfg && (
                        <Badge
                            variant="outline"
                            className={`flex items-center gap-1.5 text-xs font-medium ${cfg.badgeClass}`}
                        >
                            {cfg.icon}
                            {cfg.label}
                        </Badge>
                    )}
                    {!cfg && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                            Not started
                        </Badge>
                    )}
                </div>
                <CardDescription className="text-xs">
                    {cfg ? cfg.description : 'Click below to generate AI-powered subtitles for this video.'}
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 pt-0">
                {/* Meta row: retry count + last attempt */}
                {(retryCount !== undefined && retryCount > 0 || lastAttempt) && (
                    <>
                        <Separator />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            {retryCount !== undefined && retryCount > 0 && (
                                <span>{retryCount} attempt{retryCount !== 1 ? 's' : ''}</span>
                            )}
                            {lastAttempt && (
                                <span>Last tried {formatRelative(lastAttempt)}</span>
                            )}
                        </div>
                    </>
                )}

                {/* Failure reason */}
                {status === 'failed' && failureReason && (
                    <Alert variant="destructive" className="py-2 px-3">
                        <XCircle className="h-3.5 w-3.5" />
                        <AlertDescription className="text-xs ml-1">
                            {failureReason}
                        </AlertDescription>
                    </Alert>
                )}

                {/* Processing progress hint */}
                {status === 'processing' && (
                    <div className="flex items-center gap-2 rounded-md bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-xs text-blue-700 dark:text-blue-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                        AI transcription in progress. The video will update automatically.
                    </div>
                )}

                {/* Completed + subtitle URL check mismatch */}
                {status === 'completed' && !hasSubtitleUrl && (
                    <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                        Subtitles are marked complete but the track is still propagating — try refreshing in a moment.
                    </div>
                )}

                {/* Action button */}
                {isAdmin && (
                    <Button
                        variant={status === 'completed' ? 'outline' : 'default'}
                        size="sm"
                        className="w-full"
                        onClick={onRetry}
                        disabled={isRetrying || !canRetry}
                        title={
                            isProcessing
                                ? 'Generation is already in progress'
                                : undefined
                        }
                    >
                        {isRetrying ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <RefreshCw className="mr-2 h-3.5 w-3.5" />
                        )}
                        {isRetrying
                            ? 'Queuing…'
                            : isProcessing
                            ? 'Generation in progress…'
                            : status === 'completed'
                            ? 'Regenerate Subtitles'
                            : 'Generate Subtitles'}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
