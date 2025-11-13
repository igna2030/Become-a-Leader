import { ReferenciaItem } from "./referencia-item";
export interface Items {
    name:string,
    category:ReferenciaItem,
    localizedName?:string,
    description:string,
    sprite?:string
}

