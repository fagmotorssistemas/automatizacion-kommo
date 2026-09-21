import { Injectable } from '@nestjs/common';
import { assigneeForKommoUser, extractResponsibleUserId } from './seller-map';

@Injectable()
export class HandoffService {
  assigneeFromKommoLead(raw: unknown): string {
    return assigneeForKommoUser(extractResponsibleUserId(raw));
  }
}
