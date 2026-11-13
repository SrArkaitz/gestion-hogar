import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Comment } from '@hogar/shared';
import { AppRequest } from '../common/request';
import { HouseholdGuard } from '../households/household.guard';
import { Section, SectionGuard } from '../households/section.guard';
import { CommentsService, CommentTarget } from './comments.service';

const target = (kind: CommentTarget['kind'], householdId: string, id: string, req: AppRequest): CommentTarget => ({
  kind,
  householdId,
  id,
  userId: req.user!.id,
});

/** Comentarios de una tarea (las personales, solo quien la creó). */
@Controller('households/:householdId/tasks/:id/comments')
@UseGuards(HouseholdGuard, SectionGuard)
@Section('tareas')
export class TaskCommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  list(@Param('householdId') householdId: string, @Param('id') id: string, @Req() req: AppRequest): Promise<Comment[]> {
    return this.comments.list(target('task', householdId, id, req));
  }

  @Post()
  add(@Param('householdId') householdId: string, @Param('id') id: string, @Req() req: AppRequest, @Body() body: unknown): Promise<Comment> {
    return this.comments.add(target('task', householdId, id, req), body);
  }

  @Delete(':commentId')
  @HttpCode(204)
  remove(
    @Param('householdId') householdId: string,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Req() req: AppRequest,
  ): Promise<void> {
    return this.comments.remove(target('task', householdId, id, req), commentId, req.membership!.role);
  }
}

/** Comentarios de una idea. */
@Controller('households/:householdId/ideas/:id/comments')
@UseGuards(HouseholdGuard, SectionGuard)
@Section('ideas')
export class IdeaCommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  list(@Param('householdId') householdId: string, @Param('id') id: string, @Req() req: AppRequest): Promise<Comment[]> {
    return this.comments.list(target('idea', householdId, id, req));
  }

  @Post()
  add(@Param('householdId') householdId: string, @Param('id') id: string, @Req() req: AppRequest, @Body() body: unknown): Promise<Comment> {
    return this.comments.add(target('idea', householdId, id, req), body);
  }

  @Delete(':commentId')
  @HttpCode(204)
  remove(
    @Param('householdId') householdId: string,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Req() req: AppRequest,
  ): Promise<void> {
    return this.comments.remove(target('idea', householdId, id, req), commentId, req.membership!.role);
  }
}
