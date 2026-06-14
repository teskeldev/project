"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Copy,
  Check,
  X,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  fetchApiKeys,
  createApiKey,
  revokeApiKey,
  type ApiKeyMasked,
  type ApiKeyCreated,
} from "@/lib/client/settings";
import {
  Button,
  Input,
  Card,
  CardContent,
  Separator,
} from "@/components/ui";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function StatusMessage({
  message,
  type,
}: {
  message: string | null;
  type: "success" | "error";
}) {
  if (!message) return null;
  return (
    <div
      className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
        type === "success"
          ? "bg-green-50 text-green-700"
          : "bg-red-50 text-red-700"
      }`}
    >
      {type === "error" && <AlertCircle size={14} />}
      {type === "success" && <Check size={14} />}
      {message}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function KeysTab() {
  const [keys, setKeys] = useState<ApiKeyMasked[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [creating, setCreating] = useState(false);

  const [newKey, setNewKey] = useState<ApiKeyCreated | null>(null);
  const [copied, setCopied] = useState(false);

  const loadKeys = useCallback(() => {
    setLoading(true);
    fetchApiKeys()
      .then((r) => setKeys(r.keys))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const handleCreate = async () => {
    if (!keyName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const created = await createApiKey(keyName.trim());
      setNewKey(created);
      setKeyName("");
      setShowCreate(false);
      loadKeys();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: string, keyNameStr: string) => {
    if (!confirm(`Revoke API key "${keyNameStr}"? This cannot be undone.`))
      return;
    try {
      await revokeApiKey(keyId);
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to revoke key");
    }
  };

  const handleCopy = async () => {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <h2 className="mb-4 text-lg font-medium text-gray-900">API Keys</h2>

      {/* New key modal */}
      {newKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="mx-4 w-full max-w-md shadow-xl">
            <CardContent className="pt-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  API Key Created
                </h3>
                <button
                  onClick={() => {
                    setNewKey(null);
                    setCopied(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                <strong>Warning:</strong> This key will only be shown once. Copy
                it now and store it securely.
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <code className="flex-1 break-all text-xs text-gray-700">
                  {newKey.key}
                </code>
                <Button variant="ghost" size="icon" onClick={handleCopy}>
                  {copied ? (
                    <Check size={16} className="text-green-500" />
                  ) : (
                    <Copy size={16} />
                  )}
                </Button>
              </div>
              <Button
                className="mt-4 w-full"
                onClick={() => {
                  setNewKey(null);
                  setCopied(false);
                }}
              >
                Done
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <p className="mb-4 text-sm text-gray-500">
            Use API keys to integrate Teskel with your own tools and workflows.
          </p>

          {error && <StatusMessage message={error} type="error" />}

          {showCreate ? (
            <div className="mb-4 flex items-end gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-gray-500">
                  Key name
                </label>
                <Input
                  type="text"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g. Production key"
                />
              </div>
              <Button
                onClick={handleCreate}
                disabled={creating || !keyName.trim()}
              >
                {creating ? "Creating..." : "Create"}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button onClick={() => setShowCreate(true)}>
              <Plus size={14} />
              Generate new key
            </Button>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {keys.map((k, i) => (
                <div key={k.id}>
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {k.name}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-gray-400">
                        {k.maskedKey}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>
                        Created{" "}
                        {new Date(k.createdAt).toLocaleDateString()}
                      </span>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => handleRevoke(k.id, k.name)}
                      >
                        Revoke
                      </Button>
                    </div>
                  </div>
                  {i < keys.length - 1 && <Separator className="my-1" />}
                </div>
              ))}
              {keys.length === 0 && !loading && (
                <p className="py-4 text-center text-sm text-gray-400">
                  No API keys yet.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
