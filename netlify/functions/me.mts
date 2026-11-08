import { handle, json, requireUser, whoAmI } from "../../shared/server"

export default handle(async (req) => {
  const gate = await requireUser(req)
  if (gate instanceof Response) return gate
  return json(await whoAmI(gate.user))
})
