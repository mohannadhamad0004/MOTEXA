import { useState } from "react";
import { ProviderLayout } from "../../../components/layout/ProviderLayout";
import { SearchBar } from "../../../components/ui/Input";
import { ALL_CATEGORIES,labelOf } from "../../../core/constants/categories";
import { Panel,Text,useDT } from "../../provider/portal/ui";
export default function CategoriesPage(){const d=useDT(),[q,setQ]=useState("");return <ProviderLayout area="parts" title={d.t("Categories","الفئات")}><Panel><Text style={{color:d.muted,textAlign:d.align,lineHeight:22}}>{d.t("MOTEXA manages the shared taxonomy. Choose an existing category while editing a product.","تدير موتكسا تصنيف الفئات المشترك. اختر فئة موجودة عند تعديل المنتج.")}</Text></Panel><SearchBar value={q} onChange={setQ} placeholder={d.t("Search categories","ابحث عن فئة")}/>{ALL_CATEGORIES.filter(c=>labelOf(c,d.ar).toLowerCase().includes(q.toLowerCase())).map(c=><Panel key={c.key}><Text style={{color:d.ink,textAlign:d.align}}>{labelOf(c,d.ar)}</Text></Panel>)}</ProviderLayout>;}
