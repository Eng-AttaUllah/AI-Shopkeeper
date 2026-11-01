"use client";

import { CustomerProposalCard } from "@/components/assistant/customer-proposal-card";
import { ExpenseProposalCard } from "@/components/assistant/expense-proposal-card";
import { PaymentProposalCard } from "@/components/assistant/payment-proposal-card";
import { ProductProposalCard } from "@/components/assistant/product-proposal-card";
import { ProductUpdateProposalCard } from "@/components/assistant/product-update-proposal-card";
import { SaleProposalCard } from "@/components/assistant/sale-proposal-card";
import { StockAdjustmentProposalCard } from "@/components/assistant/stock-adjustment-proposal-card";
import type { AssistantProposal } from "@/modules/assistant/proposal-schema";

type ProposalCardProps = {
  proposal: AssistantProposal;
};

/** Render the confirmation card for whichever proposal the assistant made. */
export function ProposalCard({ proposal }: ProposalCardProps) {
  switch (proposal.kind) {
    case "sale":
      return <SaleProposalCard proposal={proposal.proposal} />;
    case "expense":
      return <ExpenseProposalCard proposal={proposal.proposal} />;
    case "payment":
      return <PaymentProposalCard proposal={proposal.proposal} />;
    case "customer":
      return <CustomerProposalCard proposal={proposal.proposal} />;
    case "product":
      return <ProductProposalCard proposal={proposal.proposal} />;
    case "product_update":
      return <ProductUpdateProposalCard proposal={proposal.proposal} />;
    case "stock_adjustment":
      return <StockAdjustmentProposalCard proposal={proposal.proposal} />;
  }
}
