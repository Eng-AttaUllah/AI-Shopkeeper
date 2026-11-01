"use client";

import { ExpenseProposalCard } from "@/components/assistant/expense-proposal-card";
import { PaymentProposalCard } from "@/components/assistant/payment-proposal-card";
import { SaleProposalCard } from "@/components/assistant/sale-proposal-card";
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
  }
}
