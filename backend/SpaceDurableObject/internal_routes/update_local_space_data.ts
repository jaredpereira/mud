import { Env } from "..";
import { makeRoute } from "backend/lib/api";
import { z } from "zod";
import { space_input } from "../routes/create_space";
import { createClient } from "@supabase/supabase-js";
import { Database } from "backend/lib/database.types";

export const update_local_space_data_route = makeRoute({
  route: "update_local_space_data",
  input: z.object({
    spaceID: z.string(),
    data: space_input
      .merge(
        z.object({
          deleted: z.boolean().optional(),
        })
      )
      .partial(),
  }),
  handler: async (msg, env: Env) => {
    const supabase = createClient<Database>(
      env.env.SUPABASE_URL,
      env.env.SUPABASE_API_TOKEN
    );
    let spaceEntity = (
      await env.factStore.scanIndex.ave("space/id", msg.spaceID)
    )?.entity;
    if (!spaceEntity) {
      if (msg.spaceID === env.id) {
        spaceEntity = (await env.factStore.scanIndex.aev("this/name"))[0]
          ?.entity;
      } else
        return { data: { success: false, error: "No space found" } } as const;
    }

    if (msg.data.image) {
      await env.factStore.assertFact({
        entity: spaceEntity,
        attribute: "space/door/uploaded-image",
        value: msg.data.image,
        positions: {},
      });
    }

    if (msg.data.start_date !== undefined) {
      if (msg.data.start_date === "") {
        let existingFact = await env.factStore.scanIndex.eav(
          spaceEntity,
          "space/start-date"
        );
        if (existingFact) await env.factStore.retractFact(existingFact.id);
      } else {
        await env.factStore.assertFact({
          entity: spaceEntity,
          attribute: "space/start-date",
          value: { type: "yyyy-mm-dd", value: msg.data.start_date },
          positions: {},
        });
      }
    }

    if (msg.data.end_date !== undefined) {
      if (msg.data.end_date === "") {
        let existingFact = await env.factStore.scanIndex.eav(
          spaceEntity,
          "space/end-date"
        );
        if (existingFact) await env.factStore.retractFact(existingFact.id);
      } else {
        await env.factStore.assertFact({
          entity: spaceEntity,
          attribute: "space/end-date",
          value: { type: "yyyy-mm-dd", value: msg.data.end_date },
          positions: {},
        });
      }
    }
    if (msg.data.publish_on_listings_page !== undefined) {
      let community = await env.factStore.scanIndex.eav(
        spaceEntity,
        "space/community"
      );
      if (!community && msg.data.publish_on_listings_page) {
        let { data: communityData } = await supabase
          .from("communities")
          .select("*")
          .eq("name", "hyperlink")
          .single();
        if (communityData)
          env.factStore.assertFact({
            entity: spaceEntity,
            attribute: "space/community",
            value: communityData.spaceID,
            positions: {},
          });
      }
      if (community && !msg.data.publish_on_listings_page) {
        env.factStore.retractFact(community.id);
      }
    }

    if (msg.data.display_name !== undefined) {
      await env.factStore.assertFact({
        entity: spaceEntity,
        attribute: "space/display_name",
        value: msg.data.display_name,
        positions: {},
      });
    }

    if (msg.data.description !== undefined) {
      await env.factStore.assertFact({
        entity: spaceEntity,
        attribute: "space/description",
        value: msg.data.description,
        positions: {},
      });
    }

    //ACTUALLY DELETES ALL THE DATA
    if (msg.data.deleted) {
      let references = await env.factStore.scanIndex.vae(spaceEntity);
      let facts = await env.factStore.scanIndex.eav(spaceEntity, null);
      await Promise.all(
        facts.concat(references).map((f) => env.factStore.retractFact(f.id))
      );
    }

    env.poke();
    return { data: { success: true } };
  },
});
