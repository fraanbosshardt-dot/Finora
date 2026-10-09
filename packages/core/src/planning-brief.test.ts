import {it,expect} from "vitest";
import {planningBrief} from "./planning-brief";
import {debtSchedule,type Debt} from "./debts";
import type {Ledger} from "./schemas";
const id="00000000-0000-4000-8000-000000000001";
const ledger:Ledger={accounts:[{id,name:"Banco",currency:"ARS",openingMinor:"10000",openingDate:"2026-01-01"}],transactions:[]};
it("resume metas y presupuestos por moneda y mes sin perder el exceso",()=>{
 const goal={id,name:"Fondo",currency:"ARS" as const,targetMinor:"10000",savedMinor:"6000",targetDate:"2026-12-31"};
 const budget={id,categoryId:id,currency:"ARS" as const,month:"2026-10",amountMinor:"1000"};
 const result=planningBrief({...ledger,transactions:[{id,accountId:id,categoryId:id,type:"expense",amountMinor:"1200",date:"2026-10-01",description:"Compra",category:"General"}]},{recurrences:[],installments:[]},[goal,{...goal,currency:"USD"}],[budget,{...budget,month:"2026-09"}],"ARS","2026-10-09");
 expect(result.goals).toHaveLength(1);expect(result.goals[0]!.percent).toBe(60);expect(result.goals[0]!.contributionMinor).toBe("1334");expect(result.budgets).toHaveLength(1);expect(result.budgets[0]!.overMinor).toBe("200");
});
it("el avance de préstamo usa pagos confirmados y selecciona el próximo pendiente",()=>{
 const debt:Debt={id,name:"Préstamo",accountId:id,categoryId:id,principalMinor:"3000",receivedMinor:"3000",monthlyRate:"0",chargesMinor:"0",count:3,system:"german",disbursementDate:"2026-01-01",firstDate:"2026-02-01",active:true};
 const first=debtSchedule(debt)[0]!;
 const result=planningBrief({...ledger,transactions:[{id,accountId:id,categoryId:id,type:"expense",amountMinor:first.totalMinor,date:first.date,description:"Pago",category:"Préstamos",occurrenceKey:first.key}]},{recurrences:[],installments:[],debts:[debt]},[],[],"ARS","2026-02-01");
 expect(result.debts[0]).toMatchObject({paidCount:1,count:3,percent:33,remainingMinor:"2000"});expect(result.debts[0]!.next?.number).toBe(2);
});
