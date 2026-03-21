"""APScheduler-backed cron scheduler for skills."""
from __future__ import annotations
import asyncio
from typing import TYPE_CHECKING

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

if TYPE_CHECKING:
    from ..agent.loop import AgentLoop

class SkillScheduler:
    def __init__(self):
        self._scheduler = AsyncIOScheduler()
        self._agent_loop: "AgentLoop | None" = None
        self._sessions: dict = {}
        self._trace_cb = None

    def configure(self, agent_loop: "AgentLoop", sessions: dict, trace_cb=None):
        self._agent_loop = agent_loop
        self._sessions = sessions
        self._trace_cb = trace_cb

    async def start(self):
        """Start scheduler and load all enabled cron jobs from DB."""
        from .models import list_cron_jobs, get_skill
        jobs = await list_cron_jobs()
        for job in jobs:
            if job["enabled"]:
                self._add_job(job)
        self._scheduler.start()
        print(f"[scheduler] Started with {len([j for j in jobs if j['enabled']])} active job(s)")

    def stop(self):
        if self._scheduler.running:
            self._scheduler.shutdown(wait=False)

    def _add_job(self, job: dict):
        try:
            self._scheduler.add_job(
                self._run_job,
                CronTrigger.from_crontab(job["cronExpression"]),
                id=job["id"],
                args=[job["id"], job["skillId"]],
                replace_existing=True,
                misfire_grace_time=60,
            )
            print(f"[scheduler] Scheduled job {job['id'][:8]} ({job['cronExpression']})")
        except Exception as e:
            print(f"[scheduler] Failed to schedule job {job['id'][:8]}: {e}")

    def schedule_job(self, job: dict):
        if job["enabled"]:
            self._add_job(job)
        else:
            self.unschedule_job(job["id"])

    def unschedule_job(self, job_id: str):
        try:
            self._scheduler.remove_job(job_id)
        except Exception as e:
            print(f"[scheduler] unschedule_job {job_id[:8]}: {e}")

    async def _run_job(self, job_id: str, skill_id: str):
        from .models import get_skill, touch_last_run
        from .runner import run_skill

        if not self._agent_loop:
            return

        skill = await get_skill(skill_id)
        if not skill:
            print(f"[scheduler] Skill {skill_id} not found for job {job_id}")
            return

        print(f"[scheduler] Running job {job_id[:8]} skill={skill['name']!r}")
        try:
            await run_skill(
                skill_id=skill_id,
                prompt=skill["prompt"],
                agent_loop=self._agent_loop,
                sessions=self._sessions,
                trace_cb=self._trace_cb,
                job_id=job_id,
            )
            await touch_last_run(job_id)
        except Exception as e:
            print(f"[scheduler] Job {job_id[:8]} failed: {e}")

skill_scheduler = SkillScheduler()
