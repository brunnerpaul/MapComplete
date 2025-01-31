import SourceConfig from "../../../Models/ThemeConfig/SourceConfig"
import { TagUtils } from "../../../Logic/Tags/TagUtils"
import { describe, expect, it } from "vitest"

describe("SourceConfig", () => {
    it("should throw an error on conflicting tags", () => {
        expect(() => {
            new SourceConfig(
                {
                    osmTags: TagUtils.Tag({
                        and: ["x=y", "a=b", "x!=y"],
                    }),
                },
                false
            )
        }).toThrowError(/tags are conflicting/)
    })
})
