import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type TimelineEventInput = {
  projectId: string;
  eventType: string;
  eventTitle: string;
  eventDescription?: string;
  actorUserId?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  metadataJson?: Prisma.InputJsonValue;
};

export async function createTimelineEvent(input: TimelineEventInput) {
  return prisma.projectTimelineEvent.create({
    data: {
      projectId: input.projectId,
      eventType: input.eventType,
      eventTitle: input.eventTitle,
      eventDescription: input.eventDescription,
      actorUserId: input.actorUserId,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      metadataJson: input.metadataJson
    }
  });
}
