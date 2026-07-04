export type SessionStatus = {
  inSession:    boolean;
  sessionName:  string;
  targetLabel:  string;
  remainingSec: number;
};

export function getSessionStatus(): SessionStatus {
  const now = new Date();
  const md  = new Date(now.toLocaleString("en-US", { timeZone: "Australia/Melbourne" }));
  const h = md.getHours(), m = md.getMinutes(), s = md.getSeconds();
  const tot = h * 3600 + m * 60 + s;

  if (tot < 3600)
    return { inSession: true,  sessionName: "Session 2", targetLabel: "1:00 AM",  remainingSec: 3600      - tot };
  if (tot < 18 * 3600)
    return { inSession: false, sessionName: "Session 1", targetLabel: "6:00 PM",  remainingSec: 18 * 3600 - tot };
  if (tot < 19 * 3600)
    return { inSession: true,  sessionName: "Session 1", targetLabel: "7:00 PM",  remainingSec: 19 * 3600 - tot };
  if (tot < 20 * 3600)
    return { inSession: false, sessionName: "Session 2", targetLabel: "8:00 PM",  remainingSec: 20 * 3600 - tot };
  return   { inSession: true,  sessionName: "Session 2", targetLabel: "1:00 AM",  remainingSec: 25 * 3600 - tot };
}
