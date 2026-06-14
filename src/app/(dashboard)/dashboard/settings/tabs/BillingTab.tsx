"use client";

import Link from "next/link";
import { CreditCard } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
} from "@/components/ui";

export default function BillingTab() {
  return (
    <div>
      <h2 className="mb-4 text-lg font-medium text-gray-900">
        Billing & Plans
      </h2>
      <Card>
        <CardContent className="pt-6">
          <p className="mb-4 text-sm text-gray-600">
            Manage your subscription and billing on the dedicated Billing page.
          </p>
          <Button asChild>
            <Link href="/dashboard/billing">
              <CreditCard size={16} />
              Go to Billing
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
